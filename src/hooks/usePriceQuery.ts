import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type { UniversalisListing, UniversalisHistory, UniversalisResponse } from "../types";
import { REGION_MAP, UNIVERSALIS_BASE, UNIVERSALIS_PROXY_BASE, HISTORY_API_BASE, isWorldName } from "../constants";
import { loadUseProxy } from "../utils/proxy";

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
 * 出售列表与交易历史拆成两个并行请求（列表 60 条、历史 60 条），带内存缓存。
 */
export function usePriceQuery() {
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const cache = useRef<Map<string, UniversalisResponse>>(new Map());

  /** 交易历史：优先访问服务器，失败回退直连 Universalis */
  const fetchHistory = useCallback(async (itemId: number, regionKey: string, hqOnly: boolean): Promise<UniversalisHistory[]> => {
    const path = REGION_MAP[regionKey] ?? regionKey;
    const hqParam = hqOnly ? "&hq=true" : "";
    // 1) 最近历史接口
    const apiUrl = new URL(`${HISTORY_API_BASE}/api/items/${itemId}/recent-history`);
    apiUrl.searchParams.set("limit", "60");
    if (regionKey && regionKey !== "中国") {
      apiUrl.searchParams.set(isWorldName(regionKey) ? "world" : "region", regionKey);
    }
    if (hqOnly) apiUrl.searchParams.set("hq", "1");
    try {
      const res = await fetch(apiUrl, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows?: UniversalisHistory[] };
      return data.rows ?? [];
    } catch {
      // 2) 回退直连 Universalis
      const fallback = await fetch(`${UNIVERSALIS_BASE}/api/v2/${path}/${itemId}?listings=0&entries=60${hqParam}`);
      if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
      const d = (await fallback.json()) as UniversalisResponse;
      return normalizeWorldNames(d).recentHistory ?? [];
    }
  }, []);

  const doFetch = useCallback((itemId: number, regionKey: string, hqOnly: boolean) => {
    const key = `${itemId}-${regionKey}-${hqOnly ? "hq" : "all"}`;
    const cached = cache.current.get(key);
    if (cached) { setPriceData(cached); return; }
    setPriceLoading(true);
    setPriceData(null);
    // 查询目标直接传中文名："中国"→china，大区/服务器名作为路径本身（Universalis 支持）
    const path = REGION_MAP[regionKey] ?? regionKey;
    // 设置中勾选"代理"后，代理访问 Universalis（替换 baseURL）
    const base = loadUseProxy() ? UNIVERSALIS_PROXY_BASE : UNIVERSALIS_BASE;
    const hqParam = hqOnly ? "&hq=true" : "";
    // 出售列表：60 条、不带交易历史（entries=0，加速访问）
    const listingsPromise = fetch(`${base}/api/v2/${path}/${itemId}?listings=60&entries=0${hqParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<UniversalisResponse>;
      });
    // 交易历史：60 条（失败自动回退直连）
    const historyPromise = fetchHistory(itemId, regionKey, hqOnly);

    Promise.all([listingsPromise, historyPromise])
      .then(([listingsData, recentHistory]) => {
        const merged = normalizeWorldNames({ ...listingsData, recentHistory });
        cache.current.set(key, merged);
        setPriceData(merged);
      })
      .catch(() => message.error("查价失败"))
      .finally(() => setPriceLoading(false));
  }, [fetchHistory]);

  return {
    priceData,
    priceLoading,
    setPriceData,
    fetchPriceData: useCallback((id: number, region: string, _name?: string, hqOnly = false) => doFetch(id, region, hqOnly), [doFetch]),
    clearPrice: useCallback(() => { cache.current.clear(); setPriceData(null); }, []),
  };
}
