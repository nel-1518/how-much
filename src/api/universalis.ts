/**
 * Universalis 行情接口封装。
 *
 * 统一职责（供各查价 hook 复用）：
 *  - URL 组装（查询范围 → 路径的映射集中在此，避免散落重复）
 *  - HTTP 错误映射为携带状态码的 `ApiError`
 *  - 透传 `AbortSignal`，调用方可在切换物品 / 卸载时取消在途请求
 */
import { REGION_MAP, UNIVERSALIS_BASE } from "../constants";
import type {
  AggregatedResponse,
  UniversalisHistoryResponse,
  UniversalisResponse,
} from "../types";

/** 一次批量查价最多允许的物品数 */
export const MAX_BATCH_ITEMS = 100;

/** 统一的接口错误：可携带 HTTP 状态码（网络不可达时无状态码） */
export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  /** 无法建立连接（网络不可达 / DNS 失败）时的提示 */
  connectError: string;
  /** 收到非 2xx 响应时的兜底提示（接收状态码） */
  httpError: (status: number) => string;
}

/**
 * 统一 JSON 请求：
 *  - 连接失败 → `connectError`
 *  - 非 2xx → 优先取响应体 `error` 字段，否则用 `httpError(status)`
 *  - `AbortError` 原样抛出（交由调用方识别为取消，不当作业务错误）
 */
async function requestJSON<T>(url: string, opts: RequestOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, signal: opts.signal });
  } catch (e) {
    if ((e as Error | undefined)?.name === "AbortError") throw e;
    throw new ApiError(opts.connectError);
  }
  if (!res.ok) {
    let message = opts.httpError(res.status);
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* 保留默认信息 */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** 查询范围 → Universalis 路径（中国 → china；大区 / 服务器名原样作为路径） */
export function buildRegionPath(scope: string): string {
  return REGION_MAP[scope] ?? scope;
}

/** 出售挂单 URL（60 条、不带交易历史；hqOnly 时追加 hq=true） */
export function listingsUrl(itemId: number, scope: string, hqOnly: boolean): string {
  const path = buildRegionPath(scope);
  const hqParam = hqOnly ? "&hq=true" : "";
  return `${UNIVERSALIS_BASE}/api/v2/${path}/${itemId}?listings=60&entries=0${hqParam}`;
}

/** 交易历史 URL（近 30 天，最多 120 条） */
export function historyUrl(itemId: number, scope: string): string {
  const path = buildRegionPath(scope);
  return `${UNIVERSALIS_BASE}/api/v2/history/${path}/${itemId}?entriesToReturn=120&statsWithin=0&entriesWithin=2592000`;
}

/** 批量聚合查价 URL */
export function aggregatedUrl(scope: string, itemIds: number[]): string {
  const path = buildRegionPath(scope);
  return `${UNIVERSALIS_BASE}/api/v2/aggregated/${encodeURIComponent(path)}/${itemIds.join(",")}`;
}

/** 获取出售挂单 */
export function fetchListings(
  itemId: number,
  scope: string,
  hqOnly: boolean,
  signal?: AbortSignal,
): Promise<UniversalisResponse> {
  return requestJSON<UniversalisResponse>(listingsUrl(itemId, scope, hqOnly), {
    signal,
    connectError: "无法连接行情服务",
    httpError: (status) => `出售列表获取失败（HTTP ${status}）`,
  });
}

/** 获取交易历史 */
export function fetchHistory(
  itemId: number,
  scope: string,
  signal?: AbortSignal,
): Promise<UniversalisHistoryResponse> {
  return requestJSON<UniversalisHistoryResponse>(historyUrl(itemId, scope), {
    signal,
    connectError: "无法连接行情服务",
    httpError: (status) => `交易历史获取失败（HTTP ${status}）`,
  });
}

/** 批量聚合查价：去重、截断到上限，失败抛 `ApiError` 供上层提示 */
export function fetchAggregated(
  scope: string,
  itemIds: number[],
  signal?: AbortSignal,
): Promise<AggregatedResponse> {
  const ids = Array.from(new Set(itemIds)).slice(0, MAX_BATCH_ITEMS);
  if (ids.length === 0) return Promise.reject(new ApiError("没有可查询的物品"));
  return requestJSON<AggregatedResponse>(aggregatedUrl(scope, ids), {
    signal,
    connectError: "无法连接行情服务",
    httpError: (status) => `查询失败（HTTP ${status}）`,
  });
}
