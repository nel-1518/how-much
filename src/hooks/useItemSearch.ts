import { useState, useCallback } from "react";
import { message } from "antd";
import type { ItemResult, SearchResponse, SearchHistoryItem, CustomItemStore } from "../types";

/** 清除 FF14 物品名称中的特殊字符 */
const clean = (text: string) => text.replace(/[\uE03C\uE0BB]/g, "");

/** 构建 XIVAPI 搜索 URL */
const buildUrl = (query: string) =>
  `https://xivapi-v2.xivcdn.com/api/search?query=Name~"${encodeURIComponent(query)}" -IsUntradable=true&sheets=Item&limit=20&fields=Name,Icon`;

interface UseItemSearchParams {
  region: string;
  fetchPriceData: (itemId: number, regionKey: string) => void;
  addToHistory: (id: number, name: string) => void;
  clearPrice: () => void;
  customItems?: CustomItemStore;
}

/**
 * 物品搜索 Hook
 * 管理搜索状态、结果选取、历史回搜、粘贴搜索、Wiki 跳转
 */
export function useItemSearch({ region, fetchPriceData, addToHistory, clearPrice, customItems = {} }: UseItemSearchParams) {
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
      // 首先检查是否有匹配的自定义物品（精确匹配或前缀匹配）
      const customItem = Object.values(customItems).find(
        (item) => item.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (customItem) {
        // 如果找到自定义物品，直接使用它
        const syntheticResult: ItemResult = {
          score: 100,
          sheet: "Item",
          row_id: customItem.itemId,
          fields: {
            Name: customItem.name,
            Singular: customItem.name,
          },
        };
        setResults([syntheticResult]);
        setSelectedItem(syntheticResult);
        setShowResults(false);
        setLoading(false);
        fetchPriceData(customItem.itemId, region);
        addToHistory(customItem.itemId, customItem.name);
        return;
      }

      // 否则使用API搜索
      const res = await fetch(buildUrl(trimmed));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResponse = await res.json();
      setResults(data.results || []);
    } catch {
      message.error("请求失败，请稍后重试");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [clearPrice, region, fetchPriceData, addToHistory, customItems]);

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
    
    // 检查是否是自定义物品
    const customItem = customItems[String(item.id)];
    if (customItem) {
      const syntheticResult: ItemResult = {
        score: 100,
        sheet: "Item",
        row_id: customItem.itemId,
        fields: {
          Name: customItem.name,
          Singular: customItem.name,
        },
      };
      setResults([syntheticResult]);
      setSelectedItem(syntheticResult);
      setShowResults(false);
      fetchPriceData(item.id, region);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetch(buildUrl(item.name))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SearchResponse) => {
        const list = data.results || [];
        setResults(list);
        const match = list.find((r) => r.row_id === item.id);
        if (match) {
          setSelectedItem(match);
          setShowResults(false);
          fetchPriceData(match.row_id, region);
          if (!item.pinned) addToHistory(item.id, item.name);
        }
      })
      .catch(() => { message.error("请求失败，请稍后重试"); setResults([]); })
      .finally(() => setLoading(false));
  }, [region, fetchPriceData, addToHistory, clearPrice, customItems]);

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
