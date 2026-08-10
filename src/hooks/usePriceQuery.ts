import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type { UniversalisResponse } from "../types";
import { REGION_MAP } from "../constants";
import { registerHistoryItem } from "../utils/registerHistoryItem";

/**
 * Universalis 查价 Hook
 * 带内存缓存，支持普通查询（50 条）和强制刷新（50 条）
 */
export function usePriceQuery() {
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const cache = useRef<Map<string, UniversalisResponse>>(new Map());

  const doFetch = useCallback((itemId: number, regionKey: string, name: string | undefined, count: number, skipCache: boolean, hqOnly: boolean) => {
    const key = `${itemId}-${regionKey}-${hqOnly ? "hq" : "all"}`;
    if (!skipCache) {
      const cached = cache.current.get(key);
      if (cached) { setPriceData(cached); return; }
    } else {
      cache.current.delete(key);
    }
    setPriceLoading(true);
    setPriceData(null);
    // 每次获取商品信息时，同步向 how-much-history 服务注册该商品（失败不影响查价）
    registerHistoryItem(itemId, name);
    const path = REGION_MAP[regionKey] || "china";
    const hqParam = hqOnly ? "&hq=true" : "";
    fetch(`https://universalis.app/api/v2/${path}/${itemId}?listings=${count}&entries=${count}${hqParam}`)
      .then((r) => r.json())
      .then((d) => { cache.current.set(key, d); setPriceData(d); })
      .catch(() => message.error("查价失败"))
      .finally(() => setPriceLoading(false));
  }, []);

  return {
    priceData,
    priceLoading,
    setPriceData,
    fetchPriceData: useCallback((id: number, region: string, name?: string, hqOnly = false) => doFetch(id, region, name, 30, false, hqOnly), [doFetch]),
    refreshPrice:  useCallback((id: number, region: string, name?: string, hqOnly = false) => doFetch(id, region, name, 90, true, hqOnly), [doFetch]),
    clearPrice:    useCallback(() => { cache.current.clear(); setPriceData(null); }, []),
  };
}
