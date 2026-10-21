import { useState, useCallback } from "react";
import type { SearchHistoryItem } from "../types";
import { MAX_HISTORY } from "../constants";
import { storage } from "../storage";

/** 固定项在前，同组内按时间倒序 */
function order(list: SearchHistoryItem[]): SearchHistoryItem[] {
  return [...list].sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true) || b.time - a.time,
  );
}

/** 排序、截断到上限并持久化 */
function persist(list: SearchHistoryItem[]): SearchHistoryItem[] {
  const next = order(list).slice(0, MAX_HISTORY);
  storage.searchHistory.save(next);
  return next;
}

/**
 * 搜索历史管理 Hook
 * 固定项与普通项存于同一列表（`pinned` 字段标识），总计不超过 MAX_HISTORY 条
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => storage.searchHistory.load());

  /** 将物品添加到历史最前方；已固定的物品不重复记录 */
  const addToHistory = useCallback((id: number, name: string) => {
    setHistory((prev) => {
      const existing = prev.find((h) => h.id === id);
      if (existing?.pinned) return prev;
      const next = [{ id, name, time: Date.now(), pinned: false }, ...prev.filter((h) => h.id !== id)];
      return persist(next);
    });
  }, []);

  /** 删除指定项（固定与普通一并处理） */
  const removeHistory = useCallback((id: number) => {
    setHistory((prev) => {
      if (!prev.some((h) => h.id === id)) return prev;
      return persist(prev.filter((h) => h.id !== id));
    });
  }, []);

  /** 清空全部历史（含固定） */
  const clearHistory = useCallback(() => {
    storage.searchHistory.save([]);
    setHistory([]);
  }, []);

  /** 固定/取消固定：切换 `pinned` 字段并刷新时间，使其排到对应分组最前 */
  const togglePin = useCallback((id: number) => {
    setHistory((prev) => {
      const item = prev.find((h) => h.id === id);
      if (!item) return prev;
      const toggled: SearchHistoryItem = { ...item, pinned: !item.pinned, time: Date.now() };
      return persist([toggled, ...prev.filter((h) => h.id !== id)]);
    });
  }, []);

  return { sortedHistory: history, addToHistory, removeHistory, clearHistory, togglePin };
}
