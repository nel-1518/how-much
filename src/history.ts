import type { SearchHistoryItem } from "./types";
import { HISTORY_KEY } from "./constants";

export function loadHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as SearchHistoryItem[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveHistory(list: SearchHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}
