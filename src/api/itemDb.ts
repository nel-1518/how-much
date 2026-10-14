/**
 * 本地物品数据库（静态 JSON）下载封装。
 * 版本文件 / 数据文件均可能失败，由调用方捕获后降级到本地缓存。
 */
import { ITEM_DB_VERSION_URL, ITEM_DB_DATA_URL } from "../constants";
import type { ItemDbEntry, ItemDbVersion } from "../types";

/** 获取物品库版本信息（非 2xx 抛错） */
export async function fetchItemDbVersion(signal?: AbortSignal): Promise<ItemDbVersion> {
  const res = await fetch(ITEM_DB_VERSION_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ItemDbVersion;
}

/** 获取物品库全量数据（非 2xx 抛错） */
export async function fetchItemDbData(signal?: AbortSignal): Promise<ItemDbEntry[]> {
  const res = await fetch(ITEM_DB_DATA_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ItemDbEntry[];
}
