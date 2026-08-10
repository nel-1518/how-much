import { useState, useCallback } from "react";
import {
  DC_NAMES,
  DC_SERVERS_KEY,
  DEFAULT_REGION,
  REGION_KEY,
  dcOfWorld,
  isWorldName,
  type DcName,
} from "../constants";

/** 每个大区记忆的已选服务器（缺省=大区名，即查询整个大区） */
export type DcServerMap = Record<DcName, string>;

/** 读取并校验持久化的大区/服务器选择状态，非法值回退默认 */
function loadRegionScope(): { scope: string; dcServer: DcServerMap } {
  const fallback: DcServerMap = { "陆行鸟": "陆行鸟", "莫古力": "莫古力", "猫小胖": "猫小胖", "豆豆柴": "豆豆柴" };

  // 每个大区记忆的服务器（仅接受属于该大区的服务器名，否则回退大区名）
  const dcServer: DcServerMap = { ...fallback };
  try {
    const raw = localStorage.getItem(DC_SERVERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const dc of DC_NAMES) {
        const v = parsed[dc];
        if (typeof v === "string" && dcOfWorld(v) === dc) {
          dcServer[dc] = v;
        }
      }
    }
  } catch { /* 忽略损坏数据 */ }

  // 上次查询目标："中国" | 大区名 | 服务器名
  let scope = DEFAULT_REGION;
  try {
    const v = localStorage.getItem(REGION_KEY);
    if (v) {
      const valid =
        v === DEFAULT_REGION ||
        (DC_NAMES as readonly string[]).includes(v) ||
        isWorldName(v);
      if (valid) scope = v;
    }
  } catch { /* 忽略 */ }

  // scope 为服务器时，把该服务器同步进其大区的记忆（刷新后下拉框能正确显示已选服务器）
  const dc = dcOfWorld(scope);
  if (dc) dcServer[dc] = scope;

  return { scope, dcServer };
}

/**
 * 查价范围状态：`scope` = 当前查询目标（"中国" | 大区名 | 服务器名），
 * `dcServer` = 各大区记忆的已选服务器。选择状态持久化到本地存储。
 */
export function useRegionScope() {
  const [{ scope, dcServer }, setState] = useState(loadRegionScope);

  const persistScope = useCallback((next: string) => {
    try {
      localStorage.setItem(REGION_KEY, next);
    } catch { /* ignore */ }
  }, []);

  const persistDcServer = useCallback((next: DcServerMap) => {
    try {
      localStorage.setItem(DC_SERVERS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  /** 设置查询目标（"中国" 或大区名；服务器选择请用 selectServer） */
  const setScope = useCallback((next: string) => {
    setState((prev) => {
      if (next === prev.scope) return prev;
      return { ...prev, scope: next };
    });
    persistScope(next);
  }, [persistScope]);

  /** 选择某大区下的服务器（或该大区本身），并记忆到对应大区 */
  const selectServer = useCallback((dc: DcName, world: string) => {
    setState((prev) => ({
      scope: world,
      dcServer: { ...prev.dcServer, [dc]: world },
    }));
    persistDcServer({ ...dcServer, [dc]: world });
    persistScope(world);
  }, [persistDcServer, persistScope, dcServer]);

  return { scope, dcServer, setScope, selectServer };
}
