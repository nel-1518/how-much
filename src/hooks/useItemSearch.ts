import { useState, useCallback } from "react";
import { message } from "antd";
import type { ItemResult, SearchHistoryItem, ItemDbEntry } from "../types";

/** 清除 FF14 物品名称中的特殊字符 */
const clean = (text: string) => text.replace(/[\uE03C\uE0BB]/g, "");

interface ItemDatabase {
  searchByName: (query: string, limit?: number) => ItemDbEntry[];
  getById: (id: number) => ItemDbEntry | undefined;
  ready: boolean;
}

interface UseItemSearchParams {
  region: string;
  fetchPriceData: (itemId: number, regionKey: string) => void;
  addToHistory: (id: number, name: string) => void;
  clearPrice: () => void;
  itemDb: ItemDatabase;
}

/** 将本地 ItemDbEntry 包装为 ItemResult */
function toItemResult(entry: ItemDbEntry): ItemResult {
  return {
    score: 100,
    sheet: "Item",
    row_id: entry.id,
    fields: { Name: entry.name, Singular: entry.name },
  };
}

/**
 * 物品搜索 Hook
 * 使用本地物品数据库替代 XIVAPI 搜索
 * 管理搜索状态、结果选取、历史回搜、Wiki 跳转
 */
export function useItemSearch({ region, fetchPriceData, addToHistory, clearPrice, itemDb }: UseItemSearchParams) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [viewTab, setViewTab] = useState<string>("listings");
  const [activeIndex, setActiveIndex] = useState(0);

  /** 执行搜索的核心逻辑（本地数据库同步查询） */
  const runSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) { setResults([]); return; }

    setLoading(true);
    setActiveIndex(0);

    if (!itemDb.ready) {
      message.warning("物品数据库正在加载，请稍后");
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      const dbResults = itemDb.searchByName(trimmed, 20);
      setResults(dbResults.map(toItemResult));
    } catch {
      message.error("搜索失败，请稍后重试");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [itemDb]);

  /** 回车 / 点击搜索按钮：立即执行，并取消待定的实时搜索 */
  const doSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) { message.warning("请输入搜索内容"); return; }
    setShowResults(true);
    runSearch(trimmed);
  }, [runSearch]);

  const handleSelectItem = useCallback((item: ItemResult) => {
    setActiveIndex(0);
    setKeyword(item.fields.Name);
    setShowResults(false);
    setHasSearched(true);
    setSelectedItem(item);
    setViewTab("listings");
    fetchPriceData(item.row_id, region);
    addToHistory(item.row_id, item.fields.Name);
  }, [region, fetchPriceData, addToHistory]);

  /** 直接选中本地数据库条目（用于粘贴唯一匹配时直接查价） */
  const selectByDbEntry = useCallback((entry: ItemDbEntry) => {
    handleSelectItem(toItemResult(entry));
  }, [handleSelectItem]);

  const searchFromHistory = useCallback((item: SearchHistoryItem) => {
    setKeyword(item.name);
    setHasSearched(true);
    setShowResults(true);
    setSelectedItem(null);
    setActiveIndex(0);
    clearPrice();

    // 从本地数据库查找
    if (!itemDb.ready) {
      message.warning("物品数据库正在加载，请稍后");
      setResults([]);
      return;
    }

    const dbItem = itemDb.getById(item.id);
    if (dbItem) {
      const match = toItemResult(dbItem);
      setResults([match]);
      setSelectedItem(match);
      setShowResults(false);
      fetchPriceData(match.row_id, region);
      if (!item.pinned) addToHistory(item.id, item.name);
    } else {
      // 通过名称回退搜索
      const dbResults = itemDb.searchByName(item.name, 20);
      setResults(dbResults.map(toItemResult));
      const match = dbResults.find((r) => r.id === item.id);
      if (match) {
        setSelectedItem(toItemResult(match));
        setShowResults(false);
        fetchPriceData(match.id, region);
        if (!item.pinned) addToHistory(item.id, item.name);
      }
    }
  }, [region, fetchPriceData, addToHistory, clearPrice, itemDb]);

  const handleKeywordChange = useCallback((value: string) => {
    const c = clean(value);
    setKeyword(c);
    setActiveIndex(0);
    if (!c.trim()) {
      setResults([]);
      setLoading(false);
      setShowResults(true);
      return;
    }
    setShowResults(true);
    runSearch(c);
  }, [runSearch]);

  /** 上下键移动高亮：循环边界夹紧 */
  const moveActiveIndex = useCallback((delta: number) => {
    setActiveIndex((prev) => {
      if (results.length === 0) return prev;
      return Math.min(Math.max(prev + delta, 0), results.length - 1);
    });
  }, [results.length]);

  const handleWiki = useCallback((name: string) => {
    window.open(`https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(name)}`, "_blank");
  }, []);

  return {
    keyword,
    results, loading, hasSearched,
    showResults, setShowResults,
    activeIndex, setActiveIndex, moveActiveIndex,
    selectedItem, setSelectedItem,
    viewTab, setViewTab,
    doSearch,
    handleSelectItem,
    selectByDbEntry,
    searchFromHistory,
    handleKeywordChange,
    handleWiki,
  };
}
