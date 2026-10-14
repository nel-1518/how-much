import { useState, useCallback, useRef } from "react";
import { message } from "antd";
import type {
  UniversalisListing,
  UniversalisHistory,
  UniversalisResponse,
  UniversalisHistoryResponse,
} from "../types";
import { REGION_MAP, UNIVERSALIS_BASE } from "../constants";

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

/** 归一化交易历史条目：单服务器查询时条目没有 worldName，用顶层 worldName 补全 */
function normalizeHistoryEntries(
  entries: UniversalisHistory[] | undefined,
  worldName?: string,
): UniversalisHistory[] {
  const list = entries ?? [];
  if (!worldName) return list;
  return list.map((h) => (h.worldName ? h : { ...h, worldName }));
}

/** 合并出售列表与交易历史；任一未到时用空数组占位（先到先渲染） */
function buildMerged(
  listingsData: UniversalisResponse | null,
  recentHistory: UniversalisHistory[] | null,
): UniversalisResponse {
  return normalizeWorldNames({
    ...(listingsData ?? {}),
    listings: listingsData?.listings ?? [],
    recentHistory: recentHistory ?? [],
  });
}

/**
 * Universalis 查价 Hook
 * - 出售列表：查询时立即请求（60 条），带内存缓存。
 * - 交易历史：不再随查价直接请求，改为调用方在需要时经 fetchPriceHistory 懒加载
 *   /api/v2/history/{area}/{id}?entriesToReturn=120&statsWithin=0&entriesWithin=2592000
 */
export function usePriceQuery() {
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  // 请求失败标记（供上层展示「重新获取」按钮）
  const [listingsError, setListingsError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  // 出售列表按 item+区域+品质 缓存；交易历史按 item+区域 缓存（与品质无关，懒加载）
  const listingsCache = useRef<Map<string, UniversalisResponse>>(new Map());
  const historyCache = useRef<Map<string, UniversalisHistory[]>>(new Map());
  // 两路请求的最新数据：一路先到时，另一路据此合并
  const listingsDataRef = useRef<UniversalisResponse | null>(null);
  const historyDataRef = useRef<UniversalisHistory[] | null>(null);
  // 当前查询目标（item+区域）：异步回包据此判断是否仍为当前查询，丢弃过期结果
  const activeScopeRef = useRef<string | null>(null);

  /** 交易历史：按需请求（查询范围 = 中国 / 大区 / 服务器） */
  const fetchHistory = useCallback((itemId: number, regionKey: string) => {
    const skey = `${itemId}-${regionKey}`;
    const cached = historyCache.current.get(skey);
    if (cached) {
      historyDataRef.current = cached;
      setPriceData(buildMerged(listingsDataRef.current, cached));
      setHistoryLoading(false);
      setHistoryError(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(false);
    const path = REGION_MAP[regionKey] ?? regionKey;
    fetch(`${UNIVERSALIS_BASE}/api/v2/history/${path}/${itemId}?entriesToReturn=120&statsWithin=0&entriesWithin=2592000`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<UniversalisHistoryResponse>;
      })
      .then((data) => {
        const entries = normalizeHistoryEntries(data.entries, data.worldName);
        historyCache.current.set(skey, entries);
        if (activeScopeRef.current !== skey) return;
        historyDataRef.current = entries;
        setPriceData(buildMerged(listingsDataRef.current, entries));
        setHistoryError(false);
      })
      .catch(() => {
        if (activeScopeRef.current === skey) {
          setHistoryError(true);
          message.error("交易历史获取失败");
        }
      })
      .finally(() => {
        if (activeScopeRef.current === skey) setHistoryLoading(false);
      });
  }, []);

  const doFetch = useCallback((itemId: number, regionKey: string, hqOnly: boolean) => {
    const key = `${itemId}-${regionKey}-${hqOnly ? "hq" : "all"}`;
    const skey = `${itemId}-${regionKey}`;
    activeScopeRef.current = skey;

    // 已缓存的交易历史（懒加载：切回时无需重新请求）
    const cachedHistory = historyCache.current.get(skey) ?? null;
    const cachedListings = listingsCache.current.get(key);
    if (cachedListings) {
      listingsDataRef.current = cachedListings;
      historyDataRef.current = cachedHistory;
      setPriceData(buildMerged(cachedListings, cachedHistory));
      setListingsLoading(false);
      setHistoryLoading(false);
      setListingsError(false);
      return;
    }

    // 新查询：出售列表进入加载态，交易历史保留（有缓存则直接展示，无则为空待懒加载）
    listingsDataRef.current = null;
    historyDataRef.current = cachedHistory;
    setPriceData(cachedHistory ? buildMerged(null, cachedHistory) : null);
    setListingsLoading(true);
    setHistoryLoading(false);
    setListingsError(false);

    // 查询目标直接传中文名："中国"→china，大区/服务器名作为路径本身（Universalis 支持）
    const path = REGION_MAP[regionKey] ?? regionKey;
    const hqParam = hqOnly ? "&hq=true" : "";

    // 出售列表：60 条、不带交易历史（entries=0，加速访问）
    fetch(`${UNIVERSALIS_BASE}/api/v2/${path}/${itemId}?listings=60&entries=0${hqParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<UniversalisResponse>;
      })
      .then((listingsData) => {
        listingsCache.current.set(key, listingsData);
        if (activeScopeRef.current !== skey) return;
        listingsDataRef.current = listingsData;
        setPriceData(buildMerged(listingsData, historyDataRef.current));
        setListingsError(false);
      })
      .catch(() => {
        if (activeScopeRef.current === skey) {
          setListingsError(true);
          message.error("出售列表获取失败");
        }
      })
      .finally(() => {
        if (activeScopeRef.current === skey) setListingsLoading(false);
      });
  }, []);

  return {
    priceData,
    listingsLoading,
    historyLoading,
    listingsError,
    historyError,
    setPriceData,
    fetchPriceData: useCallback(
      (id: number, region: string, _name?: string, hqOnly = false) => doFetch(id, region, hqOnly),
      [doFetch],
    ),
    /** 交易历史懒加载：点击「交易历史」按钮时调用 */
    fetchPriceHistory: fetchHistory,
    clearPrice: useCallback(() => {
      listingsCache.current.clear();
      historyCache.current.clear();
      listingsDataRef.current = null;
      historyDataRef.current = null;
      activeScopeRef.current = null;
      setPriceData(null);
      setListingsLoading(false);
      setHistoryLoading(false);
      setListingsError(false);
      setHistoryError(false);
    }, []),
  };
}
