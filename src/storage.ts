/**
 * 本地存储（localStorage）统一管理模块。
 *
 * 约定：
 *  - 所有键名集中定义在 `STORAGE_KEYS`，统一使用 `how-much:` 前缀；业务代码不再直接书写键字符串。
 *  - 底层读写全部经过安全封装：读取失败 / JSON 解析失败 / 存储不可用（隐私模式、配额超限）
 *    一律静默回退默认值，不抛异常。
 *  - 按功能域导出强类型读写器（见文件末尾 `storage` 对象）。
 *
 * 注意：index.html 的首屏防闪烁内联脚本无法引用本模块，
 * 其中的主题键名（how-much:theme_mode）需与 `STORAGE_KEYS.themeMode` 保持一致。
 */
import type { BatchItem, ItemDbEntry, SearchHistoryItem } from "./types";
import {
  DC_NAMES,
  DEFAULT_REGION,
  DEFAULT_SIDEBAR_W,
  MAX_SIDEBAR_W,
  MIN_SIDEBAR_W,
  dcOfWorld,
  isWorldName,
  type DcName,
  type PriceFormat,
  type ThemeMode,
} from "./constants";

/** 本地存储键统一前缀 */
const PREFIX = "how-much:";

/** 全部本地存储键（单一数据源） */
export const STORAGE_KEYS = {
  /** 搜索历史（含固定项，固定与否由条目的 `pinned` 字段标识） */
  searchHistory: `${PREFIX}search_history`,
  /**
   * @deprecated 固定搜索历史已并入 `searchHistory`，本键仅用于旧数据迁移，
   * 读取一次后会被清理，业务代码不应再写入。
   */
  searchHistoryPinned: `${PREFIX}search_history_pinned`,
  /** 上次查询目标：中国 / 大区名 / 服务器名 */
  lastRegion: `${PREFIX}last_region`,
  /** 各大区记忆的已选服务器 */
  dcServers: `${PREFIX}dc_servers`,
  /** 历史侧栏展开状态 + 宽度 */
  sidebar: `${PREFIX}sidebar`,
  /** 主题模式 */
  themeMode: `${PREFIX}theme_mode`,
  /** 金额显示格式 */
  priceFormat: `${PREFIX}price_format`,
  /** 出售列表「税率」开关 */
  marketTax: `${PREFIX}market_tax`,
  /** 本地物品数据库版本 */
  itemDbVersion: `${PREFIX}item_db_version`,
  /** 本地物品数据库数据 */
  itemDbData: `${PREFIX}item_db_data`,
  /** 已保存的批量查价物品集 */
  batchSets: `${PREFIX}batch_sets`,
} as const;

// ======================== 底层安全读写原语 ========================

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rawSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 存储不可用（隐私模式 / 配额超限）时静默忽略 */
  }
}

function rawRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 读取字符串；缺失返回 fallback */
export function readString(key: string, fallback = ""): string {
  const v = rawGet(key);
  return v === null ? fallback : v;
}

/** 写入字符串 */
export function writeString(key: string, value: string): void {
  rawSet(key, value);
}

/** 读取布尔值；仅 "true" 视为 true，缺失返回 fallback */
export function readBool(key: string, fallback = false): boolean {
  const v = rawGet(key);
  return v === null ? fallback : v === "true";
}

/** 写入布尔值 */
export function writeBool(key: string, value: boolean): void {
  rawSet(key, String(value));
}

/** 读取整数；缺失/非法返回 fallback */
export function readInt(key: string, fallback: number): number {
  const v = rawGet(key);
  if (v === null) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** 读取并反序列化 JSON；缺失/损坏返回 fallback */
export function readJSON<T>(key: string, fallback: T): T {
  const v = rawGet(key);
  if (v === null) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** 序列化并写入 JSON */
export function writeJSON(key: string, value: unknown): void {
  try {
    rawSet(key, JSON.stringify(value));
  } catch {
    /* 循环引用等序列化失败时忽略 */
  }
}

/** 删除指定键 */
export function removeKey(key: string): void {
  rawRemove(key);
}

// ======================== 功能域类型 ========================

/** 各大区记忆的已选服务器（缺省 = 大区名，即查询整个大区） */
export type DcServerMap = Record<DcName, string>;

/** 已保存的批量查价物品集 */
export interface SavedBatchSet {
  id: string;
  name: string;
  items: BatchItem[];
  savedAt: number;
}

/** 历史侧栏状态 */
export interface SidebarState {
  /** 是否展开 */
  open: boolean;
  /** 侧栏宽度（px） */
  width: number;
}

// ======================== 功能域读写实现 ========================

/** 各大区默认查询目标（大区本身） */
const DEFAULT_DC_SERVER: DcServerMap = {
  "陆行鸟": "陆行鸟",
  "莫古力": "莫古力",
  "猫小胖": "猫小胖",
  "豆豆柴": "豆豆柴",
};

/** 读取并校验持久化的查价范围，非法值回退默认 */
function loadRegionScope(): { scope: string; dcServer: DcServerMap } {
  // 每个大区记忆的服务器（仅接受属于该大区的服务器名，否则回退大区名）
  const dcServer: DcServerMap = { ...DEFAULT_DC_SERVER };
  const rawDc = readJSON<Record<string, unknown>>(STORAGE_KEYS.dcServers, {});
  for (const dc of DC_NAMES) {
    const v = rawDc[dc];
    if (typeof v === "string" && dcOfWorld(v) === dc) dcServer[dc] = v;
  }

  // 上次查询目标："中国" | 大区名 | 服务器名
  let scope = DEFAULT_REGION;
  const savedScope = readString(STORAGE_KEYS.lastRegion);
  if (savedScope) {
    const valid =
      savedScope === DEFAULT_REGION ||
      (DC_NAMES as readonly string[]).includes(savedScope) ||
      isWorldName(savedScope);
    if (valid) scope = savedScope;
  }

  // scope 为服务器时，把该服务器同步进其大区的记忆（刷新后下拉框能正确显示已选服务器）
  const dc = dcOfWorld(scope);
  if (dc) dcServer[dc] = scope;

  return { scope, dcServer };
}

/** 将侧栏宽度限制在允许范围内 */
function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_W, Math.max(MIN_SIDEBAR_W, width));
}

/** 读取并校验已保存的批量物品集 */
function loadBatchSets(): SavedBatchSet[] {
  const parsed = readJSON<unknown>(STORAGE_KEYS.batchSets, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (s): s is SavedBatchSet => !!s && typeof s.name === "string" && Array.isArray(s.items),
  );
}

/** 校验并规范化搜索历史条目（丢弃非法项与重复 id） */
function normalizeHistory(list: unknown): SearchHistoryItem[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<number>();
  const out: SearchHistoryItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<SearchHistoryItem>;
    if (typeof item.id !== "number" || typeof item.name !== "string") continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      name: item.name,
      time: typeof item.time === "number" ? item.time : 0,
      pinned: item.pinned === true,
    });
  }
  return out;
}

/** 固定项在前，同组内按时间倒序 */
function sortHistory(list: SearchHistoryItem[]): SearchHistoryItem[] {
  return [...list].sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true) || b.time - a.time,
  );
}

/**
 * 读取搜索历史。
 * 兼容旧版本：把独立的固定历史键合并进主列表（标记 pinned），随后删除该旧键。
 */
function loadSearchHistory(): SearchHistoryItem[] {
  const current = normalizeHistory(readJSON<unknown>(STORAGE_KEYS.searchHistory, []));
  let merged = current;

  if (rawGet(STORAGE_KEYS.searchHistoryPinned) !== null) {
    const legacy = normalizeHistory(readJSON<unknown>(STORAGE_KEYS.searchHistoryPinned, [])).map(
      (h) => ({ ...h, pinned: true }),
    );
    const legacyIds = new Set(legacy.map((h) => h.id));
    merged = [...legacy, ...current.filter((h) => !legacyIds.has(h.id))];
    writeJSON(STORAGE_KEYS.searchHistory, sortHistory(merged));
    rawRemove(STORAGE_KEYS.searchHistoryPinned);
  }

  return sortHistory(merged);
}

/**
 * 各功能域的本地存储读写器。
 * 业务代码统一通过 `storage.<域>.<方法>` 访问，避免直接操作键名。
 */
export const storage = {
  /**
   * 搜索历史（固定项与普通项同存一处，固定项带 `pinned: true`）。
   * 读取时自动迁移旧的独立固定历史键。
   */
  searchHistory: {
    load: loadSearchHistory,
    save: (list: SearchHistoryItem[]): void =>
      writeJSON(STORAGE_KEYS.searchHistory, sortHistory(list)),
  },
  /** 主题模式 */
  theme: {
    load: (): ThemeMode => {
      const v = readString(STORAGE_KEYS.themeMode);
      return v === "light" || v === "dark" || v === "auto" ? v : "auto";
    },
    save: (mode: ThemeMode): void => writeString(STORAGE_KEYS.themeMode, mode),
  },
  /** 查价范围（查询目标 + 各大区记忆的服务器） */
  region: {
    load: loadRegionScope,
    saveScope: (scope: string): void => writeString(STORAGE_KEYS.lastRegion, scope),
    saveDcServer: (map: DcServerMap): void => writeJSON(STORAGE_KEYS.dcServers, map),
  },
  /** 历史侧栏（展开状态 + 宽度，合并存于同一键） */
  sidebar: {
    /** 读取侧栏状态，缺失/非法字段回退默认并钳制宽度 */
    load: (): SidebarState => {
      const s = readJSON<Partial<SidebarState>>(STORAGE_KEYS.sidebar, {});
      return {
        open: typeof s.open === "boolean" ? s.open : false,
        width: clampSidebarWidth(typeof s.width === "number" ? s.width : DEFAULT_SIDEBAR_W),
      };
    },
    /** 整体写入侧栏状态 */
    save: (state: SidebarState): void =>
      writeJSON(STORAGE_KEYS.sidebar, { open: state.open, width: clampSidebarWidth(state.width) }),
    /** 仅更新展开状态（保留已存宽度） */
    setOpen: (open: boolean): void => {
      storage.sidebar.save({ ...storage.sidebar.load(), open });
    },
    /** 仅更新宽度（保留已存展开状态） */
    setWidth: (width: number): void => {
      storage.sidebar.save({ ...storage.sidebar.load(), width });
    },
  },
  /** 金额显示格式 */
  priceFormat: {
    load: (): PriceFormat => {
      const v = readString(STORAGE_KEYS.priceFormat);
      return v === "comma" || v === "space4" ? v : "comma";
    },
    save: (format: PriceFormat): void => writeString(STORAGE_KEYS.priceFormat, format),
  },
  /** 出售列表「税率」开关 */
  marketTax: {
    load: (): boolean => readBool(STORAGE_KEYS.marketTax),
    save: (enabled: boolean): void => writeBool(STORAGE_KEYS.marketTax, enabled),
  },
  /** 本地物品数据库缓存 */
  itemDb: {
    loadVersion: (): string | null => rawGet(STORAGE_KEYS.itemDbVersion),
    saveVersion: (version: string): void => writeString(STORAGE_KEYS.itemDbVersion, version),
    loadData: (): ItemDbEntry[] | null => {
      const v = rawGet(STORAGE_KEYS.itemDbData);
      if (v === null) return null;
      try {
        return JSON.parse(v) as ItemDbEntry[];
      } catch {
        // 缓存损坏：清空版本与数据，触发下次重新下载
        rawRemove(STORAGE_KEYS.itemDbData);
        rawRemove(STORAGE_KEYS.itemDbVersion);
        return null;
      }
    },
    saveData: (data: ItemDbEntry[]): void => writeJSON(STORAGE_KEYS.itemDbData, data),
    clear: (): void => {
      rawRemove(STORAGE_KEYS.itemDbVersion);
      rawRemove(STORAGE_KEYS.itemDbData);
    },
  },
  /** 已保存的批量查价物品集 */
  batchSets: {
    load: loadBatchSets,
    save: (sets: SavedBatchSet[]): void => writeJSON(STORAGE_KEYS.batchSets, sets),
  },
};
