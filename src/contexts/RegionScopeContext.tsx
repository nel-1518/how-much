import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DcName } from "../constants";
import type { DcServerMap } from "../storage";
import { useRegionScope } from "../hooks/useRegionScope";

/** 查价范围上下文：查询目标、各大区记忆的服务器，及其更新函数 */
export interface RegionScopeValue {
  /** 当前查询目标："中国" | 大区名 | 服务器名 */
  scope: string;
  /** 各大区记忆的已选服务器 */
  dcServer: DcServerMap;
  /** 设置查询目标（"中国" 或大区名；选择服务器请用 selectServer） */
  setScope: (scope: string) => void;
  /** 选择某大区下的服务器（或该大区本身） */
  selectServer: (dc: DcName, world: string) => void;
}

const RegionScopeContext = createContext<RegionScopeValue | null>(null);

/** 注入查价范围：内部持有唯一的 `useRegionScope()` 状态，供深层组件直接消费 */
export function RegionScopeProvider({ children }: { children: ReactNode }) {
  const { scope, dcServer, setScope, selectServer } = useRegionScope();
  const value = useMemo<RegionScopeValue>(
    () => ({ scope, dcServer, setScope, selectServer }),
    [scope, dcServer, setScope, selectServer],
  );
  return <RegionScopeContext.Provider value={value}>{children}</RegionScopeContext.Provider>;
}

/** 读取查价范围（scope / dcServer / setScope / selectServer） */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useRegionScopeContext(): RegionScopeValue {
  const ctx = useContext(RegionScopeContext);
  if (!ctx) throw new Error("useRegionScopeContext 必须在 RegionScopeProvider 内使用");
  return ctx;
}
