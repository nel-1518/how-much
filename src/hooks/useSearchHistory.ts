import { useState, useCallback, useMemo } from "react";
import type { SearchHistoryItem } from "../types";
import { MAX_HISTORY } from "../constants";
import { loadHistory, saveHistory } from "../history";

/**
 * 搜索历史管理 Hook
 * 提供历史的增删、清空、固定/取消固定、排序功能
 */
export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(loadHistory);

  const addToHistory = useCallback((id: number, name: string) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== id);
      const next = [{ id, name, time: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((id: number) => {
    setSearchHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveHistory([]);
  }, []);

  const togglePin = useCallback((id: number) => {
    setSearchHistory((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h));
      saveHistory(next);
      return next;
    });
  }, []);

  const sortedHistory = useMemo(() =>
    [...searchHistory].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.time - a.time;
    }), [searchHistory]);

  return { searchHistory, sortedHistory, addToHistory, removeHistory, clearHistory, togglePin };
}
