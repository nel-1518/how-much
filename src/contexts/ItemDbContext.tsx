import { createContext, useContext, type ReactNode } from "react";
import { useItemDatabase } from "../hooks/useItemDatabase";

/** 本地物品数据库状态与查询方法的类型（来自 useItemDatabase） */
export type ItemDbValue = ReturnType<typeof useItemDatabase>;

const ItemDbContext = createContext<ItemDbValue | null>(null);

/**
 * 注入本地物品数据库：内部持有唯一的 `useItemDatabase()` 实例，
 * 供主页与批量查价页共享同一份数据，避免各自重复加载。
 */
export function ItemDbProvider({ children }: { children: ReactNode }) {
  const db = useItemDatabase();
  return <ItemDbContext.Provider value={db}>{children}</ItemDbContext.Provider>;
}

/** 读取物品数据库状态与查询方法 */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useItemDb(): ItemDbValue {
  const ctx = useContext(ItemDbContext);
  if (!ctx) throw new Error("useItemDb 必须在 ItemDbProvider 内使用");
  return ctx;
}
