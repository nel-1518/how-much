import { useState, useCallback, useMemo } from "react";
import type { SearchHistoryItem } from "../types";
import { MAX_HISTORY } from "../constants";
import { loadHistory, loadPinnedHistory, saveHistory, savePinnedHistory } from "../history";

interface HistoryState {
  normal: SearchHistoryItem[];
  pinned: SearchHistoryItem[];
}

/**
 * 搜索历史管理 Hook
 * 普通历史与固定历史分两组存储，总计不超过 MAX_HISTORY 条
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryState>(() => ({
    normal: loadHistory(),
    pinned: loadPinnedHistory(),
  }));

  /** 将物品添加到普通历史最前方，超出上限则截断 */
  const addToHistory = useCallback((id: number, name: string) => {
    setHistory((prev) => {
      // 如果物品已固定，不重复添加到普通历史
      if (prev.pinned.some((h) => h.id === id)) {
        return prev;
      }
      const filtered = prev.normal.filter((h) => h.id !== id);
      const next = [{ id, name, time: Date.now() }, ...filtered];
      const maxNormal = Math.max(0, MAX_HISTORY - prev.pinned.length);
      const trimmed = next.slice(0, maxNormal);
      saveHistory(trimmed);
      return { ...prev, normal: trimmed };
    });
  }, []);

  /** 从任一历史中删除指定项 */
  const removeHistory = useCallback((id: number) => {
    setHistory((prev) => {
      const nextNormal = prev.normal.filter((h) => h.id !== id);
      const nextPinned = prev.pinned.filter((h) => h.id !== id);
      saveHistory(nextNormal);
      savePinnedHistory(nextPinned);
      return { normal: nextNormal, pinned: nextPinned };
    });
  }, []);

  /** 清空全部历史（含固定） */
  const clearHistory = useCallback(() => {
    setHistory({ normal: [], pinned: [] });
    saveHistory([]);
    savePinnedHistory([]);
  }, []);

  /** 固定/取消固定：在两组之间移动 */
  const togglePin = useCallback((id: number) => {
    setHistory((prev) => {
      const inPinned = prev.pinned.find((h) => h.id === id);
      if (inPinned) {
        // 取消固定 → 移入普通历史最前方（时间戳最新）
        const newPinned = prev.pinned.filter((h) => h.id !== id);
        const newNormal = [{ id: inPinned.id, name: inPinned.name, time: Date.now() }, ...prev.normal];
        const maxNormal = Math.max(0, MAX_HISTORY - newPinned.length);
        const trimmed = newNormal.slice(0, maxNormal);
        savePinnedHistory(newPinned);
        saveHistory(trimmed);
        return { pinned: newPinned, normal: trimmed };
      } else {
        // 固定 → 从普通移入固定最前方
        const item = prev.normal.find((h) => h.id === id);
        if (!item) return prev;
        const newNormal = prev.normal.filter((h) => h.id !== id);
        const newPinned = [{ id: item.id, name: item.name, time: item.time }, ...prev.pinned];
        saveHistory(newNormal);
        savePinnedHistory(newPinned);
        return { normal: newNormal, pinned: newPinned };
      }
    });
  }, []);

  /** 合并展示：固定在前，普通按时间倒序在后 */
  const sortedHistory = useMemo(() => {
    const pinned = history.pinned.map((h) => ({ ...h, pinned: true as const }));
    const normal = history.normal.map((h) => ({ ...h, pinned: false as const }));
    return [...pinned, ...normal];
  }, [history]);

  return { sortedHistory, addToHistory, removeHistory, clearHistory, togglePin };
}
