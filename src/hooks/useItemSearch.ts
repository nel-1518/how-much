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
 * 管理搜索状态、结果选取、历史回搜、粘贴搜索、Wiki 跳转
 */
export function useItemSearch({ region, fetchPriceData, addToHistory, clearPrice, itemDb }: UseItemSearchParams) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [viewTab, setViewTab] = useState<string>("listings");

  const doSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) { message.warning("请输入搜索内容"); return; }

    setLoading(true);
    setHasSearched(true);
    setShowResults(true);
    setSelectedItem(null);
    clearPrice();

    try {
      if (!itemDb.ready) {
        message.warning("物品数据库正在加载，请稍后");
        setResults([]);
        return;
      }

      const dbResults = itemDb.searchByName(trimmed, 20);
      setResults(dbResults.map(toItemResult));
    } catch {
      message.error("搜索失败，请稍后重试");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [clearPrice, region, fetchPriceData, addToHistory, itemDb]);

  const handleSelectItem = useCallback((item: ItemResult) => {
    setKeyword(item.fields.Name);
    setShowResults(false);
    setSelectedItem(item);
    setViewTab("listings");
    fetchPriceData(item.row_id, region);
    addToHistory(item.row_id, item.fields.Name);
  }, [region, fetchPriceData, addToHistory]);

  const searchFromHistory = useCallback((item: SearchHistoryItem) => {
    setKeyword(item.name);
    setHasSearched(true);
    setShowResults(true);
    setSelectedItem(null);
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
    if (!c.trim()) { setShowResults(false); setResults([]); }
  }, []);

  const handlePasteSearch = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const c = clean(text).trim();
      if (!c) { message.warning("剪贴板为空"); return; }
      doSearch(c);
    } catch { message.error("读取剪贴板失败，请手动粘贴"); }
  }, [doSearch]);

  const handleWiki = useCallback((name: string) => {
    window.open(`https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(name)}`, "_blank");
  }, []);

  return {
    keyword,
    results, loading, hasSearched,
    showResults, setShowResults,
    selectedItem, setSelectedItem,
    viewTab, setViewTab,
    doSearch,
    handleSelectItem,
    searchFromHistory,
    handlePasteSearch,
    handleKeywordChange,
    handleWiki,
  };
}
