import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type { UniversalisListing, UniversalisHistory, UniversalisResponse } from "../types";
import { REGION_MAP } from "../constants";

/**
 * 归一化 Universalis 响应：单服务器查询时 listings/recentHistory 的每条记录
 * 不携带 worldName（只有顶层有），用顶层 worldName 补全，保证服务器列可渲染
 * 大区图标 + 服务器名（大区/中国查询条目自带 worldName，原样返回）。
 */
function normalizeWorldNames(d: UniversalisResponse): UniversalisResponse {
  const { worldName, listings, recentHistory } = d;
  if (!worldName) return d;
  const fillListing = (l: UniversalisListing): UniversalisListing =>
    l.worldName ? l : { ...l, worldName };
  const fillHistory = (h: UniversalisHistory): UniversalisHistory =>
    h.worldName ? h : { ...h, worldName };
  return {
    ...d,
    listings: listings?.map(fillListing),
    recentHistory: recentHistory?.map(fillHistory),
  };
}

/**
 * Universalis 查价 Hook
 * 带内存缓存，支持普通查询（50 条）和强制刷新（50 条）
 */
export function usePriceQuery() {
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const cache = useRef<Map<string, UniversalisResponse>>(new Map());

  const doFetch = useCallback((itemId: number, regionKey: string, _name: string | undefined, count: number, skipCache: boolean, hqOnly: boolean) => {
    const key = `${itemId}-${regionKey}-${hqOnly ? "hq" : "all"}`;
    if (!skipCache) {
      const cached = cache.current.get(key);
      if (cached) { setPriceData(cached); return; }
    } else {
      cache.current.delete(key);
    }
    setPriceLoading(true);
    setPriceData(null);
    // 查询目标直接传中文名："中国"→china，大区/服务器名作为路径本身（Universalis 支持）
    const path = REGION_MAP[regionKey] ?? regionKey;
    const hqParam = hqOnly ? "&hq=true" : "";
    fetch(`https://universalis.app/api/v2/${path}/${itemId}?listings=${count}&entries=${count}${hqParam}`)
      .then((r) => r.json())
      .then((d) => { const normalized = normalizeWorldNames(d); cache.current.set(key, normalized); setPriceData(normalized); })
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
