import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { message } from "antd";
import type { ItemDbEntry } from "../types";
import {
  DC_NAMES,
  DEFAULT_REGION,
  MARKET_PATH,
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

interface UseItemUrlSyncParams {
  itemDb: ItemDbLike;
  /** 当前查询范围（地址里没有区服参数时沿用） */
  scope: string;
  /** 设置查询范围（大区名 / "中国"） */
  setScope: (next: string) => void;
  /** 选择某大区下的服务器（记忆到该大区） */
  selectServer: (dc: DcName, world: string) => void;
  /** 按条目查价（不写地址栏，由本 hook 负责地址） */
  openItem: (entry: ItemDbEntry, regionOverride?: string) => void;
  /** 清空当前选中（地址回到 /market 时） */
  resetSelection: () => void;
  /** 当前已选中的物品 id（无选中为 null） */
  selectedId: number | null;
}

/** 解析区服参数：数字服务器 id、服务器名，也兼容大区名 / 中国。无法识别返回 null */
function resolveWorld(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return WORLD_ID_TO_NAME[Number(v)] ?? null;
  if (isWorldName(v)) return v;
  if ((DC_NAMES as readonly string[]).includes(v)) return v;
  if (v === DEFAULT_REGION || v.toLowerCase() === "china") return DEFAULT_REGION;
  return null;
}

/** 地址段解码：hash 中的中文（服务器名 / 大区名 / 中国）会被编码为 %XX，需还原后再匹配 */
function decodeSegment(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // 非法编码（如孤立的 %）按原样处理
  }
}

/** 从 pathname 解析地址参数（`/market`、`/market/{id}`、`/market/{id}/{worldId}`） */
function parsePath(pathname: string): { id?: string; worldId?: string } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "market") return {};
  return {
    id: decodeSegment(segments[1]),
    worldId: decodeSegment(segments[2]),
  };
}

/** 解析物品参数：数字物品 id 优先，非 id 时按名称精确 / 首个模糊匹配兜底 */
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
 * 单个查价页的地址栏与选中物品双向同步。
 *
 * 地址形式（HashRouter，站点子路径由 Vite base 决定）：
 * - `#/market`              首页状态（无选中物品）
 * - `#/market/{物品id}`      指定物品，沿用上次保存的查询范围
 * - `#/market/{物品id}/{区服id}` 指定物品与区服，进入后先选中该服再查价，
 *   消费后地址收敛为 `#/market/{物品id}`（刷新不会重复切换服务器）
 *
 * 写地址走 `syncUrlForItem`（push，选择物品可后退回到上一个物品）；
 * 读地址由 effect 完成（浏览器前进 / 后退、直接打开链接、刷新）。
 * `appliedKeyRef` 记录「地址已消费 / 已由本端写入」的参数组合，
 * 避免「状态 → 地址」与「地址 → 状态」互相触发导致重复查价。
 */
export function useItemUrlSync({
  itemDb,
  scope,
  setScope,
  selectServer,
  openItem,
  resetSelection,
  selectedId,
}: UseItemUrlSyncParams) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id, worldId } = useMemo(() => parsePath(pathname), [pathname]);
  const appliedKeyRef = useRef<string | null>(null);

  /** 选中物品后写地址栏（同一物品不重复写历史；带区服参数的地址收敛为物品地址） */
  const syncUrlForItem = useCallback(
    (itemId: number) => {
      const target = `${MARKET_PATH}/${itemId}`;
      // 预先标记，避免本次导航触发的路由变化再反向查价一次
      appliedKeyRef.current = `${itemId}|`;
      if (id === String(itemId)) {
        if (worldId) navigate(target, { replace: true });
        return;
      }
      navigate(target);
    },
    [id, worldId, navigate],
  );

  // 地址 → 状态：链接直达 / 前进后退 / 刷新
  useEffect(() => {
    // 数据库未就绪时先不消费参数，避免丢失深链
    if (!itemDb.ready) return;

    const key = `${id ?? ""}|${worldId ?? ""}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;

    // 无物品 id：回到首页状态
    if (!id) {
      if (selectedId !== null) resetSelection();
      return;
    }

    const entry = resolveItem(id, itemDb);
    if (!entry) {
      message.warning(`URL 指定的物品不存在：${id}`);
      navigate(MARKET_PATH, { replace: true });
      return;
    }

    const world = worldId ? resolveWorld(worldId) : null;
    if (worldId && !world) {
      message.warning(`URL 指定的区服不存在：${worldId}`);
    }
    // 携带区服参数：地址收敛为物品地址（替换历史记录，刷新不会重复切服）
    if (worldId) {
      appliedKeyRef.current = `${entry.id}|`;
      navigate(`${MARKET_PATH}/${entry.id}`, { replace: true });
    }

    // 地址与当前选中一致（如刚刚由选择动作写入地址）：不重复查价
    if (selectedId === entry.id) return;

    // 先落地查询范围，再用显式范围查价（避免用到尚未更新的 state）
    if (world) {
      const dc = dcOfWorld(world);
      if (dc) selectServer(dc, world);
      else setScope(world);
    }
    openItem(entry, world ?? scope);
  }, [
    itemDb,
    itemDb.ready,
    id,
    worldId,
    scope,
    selectedId,
    setScope,
    selectServer,
    openItem,
    resetSelection,
    navigate,
  ]);

  return { syncUrlForItem };
}
