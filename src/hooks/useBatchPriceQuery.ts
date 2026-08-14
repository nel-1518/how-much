import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type { BatchItem, AggregatedResponse } from "../types";
import { fetchAggregated, MAX_BATCH_ITEMS } from "../utils/aggregatedApi";

/**
 * 批量查价 Hook：管理已选物品、查询结果与加载状态；带内存缓存。
 * AggregatedResponse.results 以 itemId 为键返回，展示顺序由调用方按已选顺序映射。
 * 内部用请求序号使切换范围/清空后，仍在途的旧请求结果被丢弃，避免串数据。
 */
export function useBatchPriceQuery() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [results, setResults] = useState<AggregatedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, AggregatedResponse>>(new Map());
  const seqRef = useRef(0);

  const addByEntry = useCallback((entry: { id: number; name: string; canBeHq?: boolean }) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === entry.id)) return prev;
      if (prev.length >= MAX_BATCH_ITEMS) {
        message.warning("一次最多查询 " + MAX_BATCH_ITEMS + " 个物品");
        return prev;
      }
      return [...prev, { id: entry.id, name: entry.name, canBeHq: entry.canBeHq === true }];
    });
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /** 清空结果（保留已选物品）；同时使在途请求失效 */
  const clearResults = useCallback(() => {
    seqRef.current++;
    setResults(null);
    setError(null);
    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    seqRef.current++;
    setItems([]);
    setResults(null);
    setError(null);
    setLoading(false);
  }, []);

  const query = useCallback(async (scope: string) => {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    const key = scope + "-" + ids.join(",");
    const seq = ++seqRef.current;
    const cached = cache.current.get(key);
    if (cached) { setResults(cached); setError(null); return; }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchAggregated(scope, ids);
      if (seq !== seqRef.current) return; // 已切换范围/已清空，丢弃过期结果
      cache.current.set(key, data);
      setResults(data);
    } catch (e) {
      if (seq !== seqRef.current) return;
      const msg = e instanceof Error ? e.message : "查询失败";
      setError(msg);
      message.error(msg);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [items]);

  return { items, results, loading, error, addByEntry, removeItem, clear, clearResults, query };
}
