import type { SearchHistoryItem } from "./types";
import {
  HISTORY_KEY,
  HISTORY_PINNED_KEY,
  SIDEBAR_OPEN_KEY,
  SIDEBAR_WIDTH_KEY,
  MIN_SIDEBAR_W,
  MAX_SIDEBAR_W,
  DEFAULT_SIDEBAR_W,
} from "./constants";

function loadFromKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function saveToKey(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadHistory(): SearchHistoryItem[] {
  return loadFromKey<SearchHistoryItem[]>(HISTORY_KEY, []);
}

export function saveHistory(list: SearchHistoryItem[]) {
  saveToKey(HISTORY_KEY, list);
}

export function loadPinnedHistory(): SearchHistoryItem[] {
  return loadFromKey<SearchHistoryItem[]>(HISTORY_PINNED_KEY, []);
}

export function savePinnedHistory(list: SearchHistoryItem[]) {
  saveToKey(HISTORY_PINNED_KEY, list);
}

/** 加载历史侧栏展开状态 */
export function loadSidebarOpen(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return raw === null ? false : raw === "true";
  } catch {
    return false;
  }
}

/** 保存历史侧栏展开状态 */
export function saveSidebarOpen(open: boolean) {
  localStorage.setItem(SIDEBAR_OPEN_KEY, String(open));
}

/** 将侧栏宽度限制在允许范围内 */
function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_W, Math.max(MIN_SIDEBAR_W, width));
}

/** 加载历史侧栏宽度 */
export function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) return clampSidebarWidth(n);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SIDEBAR_W;
}

/** 保存历史侧栏宽度 */
export function saveSidebarWidth(width: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
}


