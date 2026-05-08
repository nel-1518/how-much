import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type { UniversalisResponse } from "../types";
import { REGION_MAP } from "../constants";

/**
 * Universalis 查价 Hook
 * 带内存缓存，支持普通查询（50 条）和强制刷新（100 条）
 */
export function usePriceQuery() {
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const cache = useRef<Map<string, UniversalisResponse>>(new Map());

  const doFetch = useCallback((itemId: number, regionKey: string, count: number, skipCache: boolean) => {
    const key = `${itemId}-${regionKey}`;
    if (!skipCache) {
      const cached = cache.current.get(key);
      if (cached) { setPriceData(cached); return; }
    } else {
      cache.current.delete(key);
    }
    setPriceLoading(true);
    setPriceData(null);
    const path = REGION_MAP[regionKey] || "china";
    fetch(`https://universalis.app/api/v2/${path}/${itemId}?listings=${count}&entries=${count}`)
      .then((r) => r.json())
      .then((d) => { cache.current.set(key, d); setPriceData(d); })
      .catch(() => message.error("查价失败"))
      .finally(() => setPriceLoading(false));
  }, []);

  return {
    priceData,
    priceLoading,
    setPriceData,
    fetchPriceData: useCallback((id: number, region: string) => doFetch(id, region, 50, false), [doFetch]),
    refreshPrice:  useCallback((id: number, region: string) => doFetch(id, region, 100, true), [doFetch]),
    clearPrice:    useCallback(() => { cache.current.clear(); setPriceData(null); }, []),
  };
}
