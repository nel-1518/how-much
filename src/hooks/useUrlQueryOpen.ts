import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { message } from "antd";
import type { ItemDbEntry } from "../types";
import {
  DC_NAMES,
  DEFAULT_REGION,
  WORLD_ID_TO_NAME,
  dcOfWorld,
  isWorldName,
  type DcName,
} from "../constants";

interface ItemDbLike {
  ready: boolean;
  getById: (id: number) => ItemDbEntry | undefined;
  findExactName: (query: string) => ItemDbEntry | undefined;
  searchByName: (query: string, limit?: number) => ItemDbEntry[];
}

interface UseUrlQueryOpenParams {
  itemDb: ItemDbLike;
  /** 当前保存的默认查询范围（无 world 参数时沿用） */
  defaultScope: string;
  /** 选中物品并查价（可显式指定本次查询范围） */
  openItem: (entry: ItemDbEntry, regionOverride?: string) => void;
  /** 选择某大区下的服务器（记忆到该大区） */
  selectServer: (dc: DcName, world: string) => void;
  /** 设置查询范围（大区名 / "中国"） */
  setScope: (next: string) => void;
}

/** 解析 world 参数：数字服务器 id、服务器名，也兼容大区名 / 中国。无法识别返回 null */
function resolveWorld(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return WORLD_ID_TO_NAME[Number(v)] ?? null;
  if (isWorldName(v)) return v;
  if ((DC_NAMES as readonly string[]).includes(v)) return v;
  if (v === DEFAULT_REGION || v.toLowerCase() === "china") return DEFAULT_REGION;
  return null;
}

/** 解析 item 参数：数字物品 id 或物品名（精确名优先，其次取首个模糊匹配） */
function resolveItem(raw: string, db: ItemDbLike): ItemDbEntry | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const byId = db.getById(Number(v));
    if (byId) return byId;
  }
  return db.findExactName(v) ?? db.searchByName(v, 1)[0] ?? null;
}

/**
 * URL 参数直达：`#/?item=<id|名称>&world=<id|名称>`
 * - item、world 均可为 id 或文字；
 * - 仅给 item（无 world）时，沿用当前保存的默认查询范围；
 * - 仅给 world 而无 item 时无效（不打开任何物品）；
 * - 物品数据库就绪后仅执行一次。
 */
export function useUrlQueryOpen({
  itemDb,
  defaultScope,
  openItem,
  selectServer,
  setScope,
}: UseUrlQueryOpenParams) {
  const appliedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (appliedRef.current || !itemDb.ready) return;

    const itemParam = searchParams.get("item");
    // 无 item（或为空）：即使带 world 也无效
    if (!itemParam || !itemParam.trim()) return;
    appliedRef.current = true;

    const worldParam = searchParams.get("world");
    const world = worldParam ? resolveWorld(worldParam) : null;

    // 参数已消费：从地址栏清掉（替换历史记录），避免刷新时重复触发
    const next = new URLSearchParams(searchParams);
    next.delete("item");
    next.delete("world");
    setSearchParams(next, { replace: true });

    const entry = resolveItem(itemParam, itemDb);
    if (!entry) {
      message.warning(`URL 指定的物品不存在：${itemParam}`);
      return;
    }

    // 先落地查询范围，再以显式范围打开物品（避免用到尚未更新的 state）
    if (world) {
      const dc = dcOfWorld(world);
      if (dc) selectServer(dc, world);
      else setScope(world);
    }

    openItem(entry, world ?? defaultScope);
  }, [itemDb, defaultScope, openItem, selectServer, setScope, searchParams, setSearchParams]);
}
