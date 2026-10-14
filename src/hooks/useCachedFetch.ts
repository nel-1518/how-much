import { useCallback, useRef, useState } from "react";

/** 一次请求的结果：ok=成功（含缓存命中）/ error=业务失败 / stale=已过期（被取消或被更新请求取代） */
export type CachedFetchRunResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "stale" };

export interface UseCachedFetchResult<T> {
  /** 最近一次成功的数据（失败 / 取消不改变它） */
  data: T | null;
  loading: boolean;
  /** 最近一次失败的错误文案；成功或取消后清空 */
  error: string | null;
  /** 外部注入数据（如需自行合并多路结果） */
  setData: (data: T | null) => void;
  /**
   * 发起一次请求：
   *  - 命中内存缓存 → 同步设置 data 并立即返回 `{ status: "ok" }`
   *  - 否则请求 `fetcher(signal)`；结果过期（被更晚的请求取代 / 已取消）时返回 `stale`
   *  - 失败设置 error 并返回 `{ status: "error" }`（不抛异常，由调用方决定是否提示）
   */
  run: (
    cacheKey: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
  ) => Promise<CachedFetchRunResult<T>>;
  /** 使在途请求失效并复位 loading / error（不清缓存，也不改 data） */
  cancel: () => void;
  /** 取消在途请求、清空内存缓存并复位全部状态 */
  reset: () => void;
}

/**
 * 带内存缓存与竞态守卫的请求 hook。
 *
 * - 缓存：按 `cacheKey` 缓存成功结果，命中时同步返回、不发请求
 * - 竞态：内部用自增序号标记请求；更晚的 `run` / `cancel` 会使在途请求结果作废
 * - 取消：每次真实请求创建 `AbortController`，被取代或 `cancel`/`reset` 时中止
 *
 * 本 hook 不依赖任何 UI 库（如 antd `message`）：失败只落到 `error`，
 * 由调用方决定展示方式（内联提示 / toast）。
 */
export function useCachedFetch<T>(options?: {
  /** 初始 loading 状态（默认 false）；首次请求前即为加载中的场景可置 true */
  initialLoading?: boolean;
}): UseCachedFetchResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(options?.initialLoading ?? false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, T>>(new Map());
  const seqRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const setData = useCallback((next: T | null) => {
    setDataState(next);
  }, []);

  const run = useCallback(
    async (
      cacheKey: string,
      fetcher: (signal: AbortSignal) => Promise<T>,
    ): Promise<CachedFetchRunResult<T>> => {
      const seq = ++seqRef.current;
      // 新的请求使旧的作废
      controllerRef.current?.abort();
      controllerRef.current = null;

      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey) as T;
        setDataState(cached);
        setError(null);
        setLoading(false);
        return { status: "ok", data: cached };
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher(controller.signal);
        if (seq !== seqRef.current) return { status: "stale" };
        cacheRef.current.set(cacheKey, result);
        setDataState(result);
        setLoading(false);
        return { status: "ok", data: result };
      } catch (e) {
        if (seq !== seqRef.current || (e as Error | undefined)?.name === "AbortError") {
          return { status: "stale" };
        }
        const message = e instanceof Error && e.message ? e.message : "请求失败";
        setError(message);
        setLoading(false);
        return { status: "error", message };
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    seqRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    seqRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    cacheRef.current.clear();
    setDataState(null);
    setLoading(false);
    setError(null);
  }, []);

  return { data, loading, error, setData, run, cancel, reset };
}
