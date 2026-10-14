import { useState, useCallback } from "react";
import { message } from "antd";
import type { BatchItem, AggregatedResponse } from "../types";
import { fetchAggregated, MAX_BATCH_ITEMS } from "../api/universalis";
import { useCachedFetch } from "./useCachedFetch";

/**
 * 批量查价 Hook：管理已选物品、查询结果与加载状态；带内存缓存。
 * AggregatedResponse.results 以 itemId 为键返回，展示顺序由调用方按已选顺序映射。
 * 请求缓存、竞态守卫与取消由 `useCachedFetch` 统一处理：切换范围/清空后，
 * 仍在途的旧请求结果会被丢弃，避免串数据。
 */
export function useBatchPriceQuery() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const { data: results, loading, error, setData, run, cancel } =
    useCachedFetch<AggregatedResponse>();

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
    cancel();
    setData(null);
  }, [cancel, setData]);

  const clear = useCallback(() => {
    cancel();
    setItems([]);
    setData(null);
  }, [cancel, setData]);

  const query = useCallback(
    async (scope: string) => {
      const ids = items.map((i) => i.id);
      if (ids.length === 0) return;
      const key = scope + "-" + ids.join(",");
      await run(key, (signal) => fetchAggregated(scope, ids, signal));
    },
    [items, run],
  );

  return { items, results, loading, error, addByEntry, removeItem, clear, clearResults, query };
}
