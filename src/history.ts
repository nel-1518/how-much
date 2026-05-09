import type { SearchHistoryItem } from "./types";
import { HISTORY_KEY, HISTORY_PINNED_KEY } from "./constants";

function loadFromKey(key: string): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as SearchHistoryItem[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveToKey(key: string, list: SearchHistoryItem[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function loadHistory(): SearchHistoryItem[] {
  return loadFromKey(HISTORY_KEY);
}

export function saveHistory(list: SearchHistoryItem[]) {
  saveToKey(HISTORY_KEY, list);
}

export function loadPinnedHistory(): SearchHistoryItem[] {
  return loadFromKey(HISTORY_PINNED_KEY);
}

export function savePinnedHistory(list: SearchHistoryItem[]) {
  saveToKey(HISTORY_PINNED_KEY, list);
}
