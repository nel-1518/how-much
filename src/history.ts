import type { SearchHistoryItem, UniversalisHistory, TransactionStore } from "./types";
import {
  HISTORY_KEY,
  HISTORY_PINNED_KEY,
  TRANSACTION_RECORDS_KEY,
  RECORDING_ENABLED_KEY,
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

// ---- 交易记录本地存储 ----

/** 加载所有本地交易记录 */
export function loadTransactionRecords(): TransactionStore {
  return loadFromKey<TransactionStore>(TRANSACTION_RECORDS_KEY, {});
}

/** 保存所有本地交易记录 */
export function saveTransactionRecords(store: TransactionStore) {
  saveToKey(TRANSACTION_RECORDS_KEY, store);
}

/**
 * 合并新获取的交易历史到本地存储（自动去重）
 * 去重依据：timestamp + worldName + pricePerUnit + hq 组合唯一
 */
export function mergeTransactionRecords(
  store: TransactionStore,
  itemId: number,
  itemName: string,
  newRecords: UniversalisHistory[],
): TransactionStore {
  const key = String(itemId);
  const existing = store[key]?.records || [];
  const existingSet = new Set(
    existing.map((r) => `${r.timestamp}|${r.worldName}|${r.pricePerUnit}|${r.hq}`),
  );
  const deduped = newRecords.filter(
    (r) => !existingSet.has(`${r.timestamp}|${r.worldName}|${r.pricePerUnit}|${r.hq}`),
  );
  return {
    ...store,
    [key]: {
      name: itemName,
      records: [...existing, ...deduped],
    },
  };
}

/** 删除所有交易记录 */
export function clearTransactionRecords() {
  localStorage.removeItem(TRANSACTION_RECORDS_KEY);
}

/** 删除交易日期超过一个月的记录 */
export function cleanExpiredTransactionRecords(): TransactionStore {
  const store = loadTransactionRecords();
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  const newStore: TransactionStore = {};
  for (const [key, entry] of Object.entries(store)) {
    const valid = entry.records.filter((r) => now - r.timestamp * 1000 <= oneMonth);
    if (valid.length > 0) {
      newStore[key] = { name: entry.name, records: valid };
    }
  }
  saveTransactionRecords(newStore);
  return newStore;
}

// ---- 记录开关 ----

/** 加载记录开关状态 */
export function loadRecordingEnabled(): boolean {
  try {
    const raw = localStorage.getItem(RECORDING_ENABLED_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

/** 保存记录开关状态 */
export function saveRecordingEnabled(enabled: boolean) {
  localStorage.setItem(RECORDING_ENABLED_KEY, String(enabled));
}


