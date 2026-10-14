import { createContext, useContext, type ReactNode } from "react";
import type { SearchHistoryItem } from "../types";

/** 搜索历史上下文：数据、当前高亮项与全部操作 */
export interface SearchHistoryValue {
  /** 合并排序后的历史（固定在前，普通按时间倒序） */
  sortedHistory: SearchHistoryItem[];
  /** 当前正在查看的物品 ID（用于高亮），无则为 null */
  activeItemId: number | null;
  /** 点击历史条目直接查价 */
  searchFromHistory: (item: SearchHistoryItem) => void;
  /** 删除一条历史 */
  removeHistory: (id: number) => void;
  /** 清空全部历史（含固定） */
  clearHistory: () => void;
  /** 固定 / 取消固定 */
  togglePin: (id: number) => void;
}

const SearchHistoryContext = createContext<SearchHistoryValue | null>(null);

/**
 * 注入搜索历史。Provider 只做透传：数据来自 App 中的 `useSearchHistory`，
 * 选中与回搜来自 `useItemSearch`，避免在历史子组件间重复钻透。
 */
export function SearchHistoryProvider({
  value,
  children,
}: {
  value: SearchHistoryValue;
  children: ReactNode;
}) {
  return <SearchHistoryContext.Provider value={value}>{children}</SearchHistoryContext.Provider>;
}

/** 读取搜索历史数据与操作 */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useSearchHistoryContext(): SearchHistoryValue {
  const ctx = useContext(SearchHistoryContext);
  if (!ctx) throw new Error("useSearchHistoryContext 必须在 SearchHistoryProvider 内使用");
  return ctx;
}
