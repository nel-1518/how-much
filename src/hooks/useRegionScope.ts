import { useState, useCallback } from "react";
import type { DcName } from "../constants";
import { storage, type DcServerMap } from "../storage";

export type { DcServerMap } from "../storage";

/**
 * 查价范围状态：`scope` = 当前查询目标（"中国" | 大区名 | 服务器名），
 * `dcServer` = 各大区记忆的已选服务器。读写统一经由 storage 模块持久化。
 */
export function useRegionScope() {
  const [{ scope, dcServer }, setState] = useState(storage.region.load);

  /** 设置查询目标（"中国" 或大区名；服务器选择请用 selectServer） */
  const setScope = useCallback((next: string) => {
    setState((prev) => {
      if (next === prev.scope) return prev;
      return { ...prev, scope: next };
    });
    storage.region.saveScope(next);
  }, []);

  /** 选择某大区下的服务器（或该大区本身），并记忆到对应大区 */
  const selectServer = useCallback((dc: DcName, world: string) => {
    const nextServer: DcServerMap = { ...dcServer, [dc]: world };
    setState({ scope: world, dcServer: nextServer });
    storage.region.saveDcServer(nextServer);
    storage.region.saveScope(world);
  }, [dcServer]);

  return { scope, dcServer, setScope, selectServer };
}
