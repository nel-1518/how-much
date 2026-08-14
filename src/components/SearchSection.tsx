import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ItemResult } from "../types";

export interface SearchSectionProps {
  keyword: string;
  results: ItemResult[];
  loading: boolean;
  /** 物品数据库状态：未就绪时输入框显示加载提示 */
  dbStatus: "loading" | "ready" | "error";
  activeIndex: number;
  inputRef: React.RefObject<React.ComponentRef<typeof Input> | null>;
  onKeywordChange: (v: string) => void;
  onSearch: (query: string) => void;
  onSelectItem: (item: ItemResult) => void;
  onMoveActive: (delta: number) => void;
}

/** 顶部搜索输入框：进入页面自动聚焦，输入内容时打开居中的搜索卡片 */
export function SearchSection({
  keyword, results, loading, dbStatus, activeIndex, inputRef,
  onKeywordChange, onSearch, onSelectItem, onMoveActive,
}: SearchSectionProps) {
  const showHistory = keyword.trim() === "";
  const dbReady = dbStatus === "ready";
  const dbLoading = dbStatus === "loading";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!showHistory && results.length > 0) {
        e.preventDefault();
        onMoveActive(1);
      }
    } else if (e.key === "ArrowUp") {
      if (!showHistory && results.length > 0) {
        e.preventDefault();
        onMoveActive(-1);
      }
    } else if (e.key === "Enter") {
      if (!showHistory && results.length > 0 && !loading) {
        e.preventDefault();
        onSelectItem(results[activeIndex]);
      } else {
        onSearch(keyword);
      }
    }
  };

  return (
    <Input
      ref={inputRef}
      size="large"
      className="search-trigger-input"
      placeholder={dbReady ? "搜索物品名称" : dbLoading ? "正在加载物品数据库…" : "物品数据库加载失败"}
      value={keyword}
      onChange={(e) => onKeywordChange(e.target.value)}
      onKeyDown={handleKeyDown}
      prefix={<SearchOutlined className="search-trigger-icon" />}
      suffix={
        !dbReady ? (
          <span className="search-db-status">{dbLoading ? "加载中…" : "加载失败"}</span>
        ) : keyword.trim() === "" ? (
          <kbd className="search-trigger-kbd">Tab</kbd>
        ) : undefined
      }
      allowClear
      autoFocus
    />
  );
}
