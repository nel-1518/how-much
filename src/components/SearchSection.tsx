import { useEffect, useRef } from "react";
import { Input, Typography, Spin, Space, Card } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ItemResult, SearchHistoryItem } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { HistorySection } from "./HistorySection";

export interface SearchSectionProps {
  keyword: string;
  results: ItemResult[];
  loading: boolean;
  showResults: boolean;
  activeIndex: number;
  history: SearchHistoryItem[];
  onKeywordChange: (v: string) => void;
  onSearch: (query: string) => void;
  onSelectItem: (item: ItemResult) => void;
  onSearchFromHistory: (item: SearchHistoryItem) => void;
  onRemoveHistory: (id: number) => void;
  onClearHistory: () => void;
  onTogglePin: (id: number) => void;
  onMoveActive: (delta: number) => void;
  onActivate: (index: number) => void;
  onFocus: () => void;
  onCloseResults: () => void;
}

/** 搜索框 + 自动完成结果列表组件 */
export function SearchSection({
  keyword, results, loading, showResults, activeIndex,
  history, onKeywordChange, onSearch, onSelectItem, onSearchFromHistory,
  onRemoveHistory, onClearHistory, onTogglePin, onMoveActive, onActivate, onFocus, onCloseResults,
}: SearchSectionProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const resultListRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, onCloseResults);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (showResults && !showHistory && results.length > 0) {
        e.preventDefault();
        onMoveActive(1);
      }
    } else if (e.key === "ArrowUp") {
      if (showResults && !showHistory && results.length > 0) {
        e.preventDefault();
        onMoveActive(-1);
      }
    } else if (e.key === "Enter") {
      if (showResults && !showHistory && results.length > 0 && !loading) {
        e.preventDefault();
        onSelectItem(results[activeIndex]);
      } else {
        onSearch(keyword);
      }
    }
  };

  const trimmed = keyword.trim();
  const showHistory = trimmed === "";

  // 高亮项变化时，确保其在结果列表可视区域内（超出则同步滚动）
  useEffect(() => {
    const list = resultListRef.current;
    const el = list?.querySelector<HTMLElement>(".result-item.active");
    if (!list || !el) return;

    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const margin = 8;
    if (elRect.top < listRect.top + margin) {
      const target = list.scrollTop - ((listRect.top + margin) - elRect.top);
      list.scrollTo({ top: target, behavior: "smooth" });
    } else if (elRect.bottom > listRect.bottom - margin) {
      const target = list.scrollTop + elRect.bottom - (listRect.bottom - margin);
      list.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [activeIndex, results]);

  return (
    <Card className={`search-card${showResults ? " open" : ""}`} variant="borderless">
      <Space direction="vertical" style={{ width: "100%", maxWidth: 600 }}>
        <div ref={searchRef} style={{ position: "relative" }}>
          <Input
            size="large"
            placeholder="输入物品名称"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            prefix={<SearchOutlined className="search-prefix-icon" />}
            allowClear
            autoFocus
            className="search-input"
          />

          {showResults && (
            <div className="search-results">
              {showHistory ? (
                <HistorySection
                  sortedHistory={history}
                  onSearchFromHistory={onSearchFromHistory}
                  onRemoveHistory={onRemoveHistory}
                  onClearHistory={onClearHistory}
                  onTogglePin={onTogglePin}
                />
              ) : loading ? (
                <div className="search-loading"><Spin size="small" /><span>搜索中...</span></div>
              ) : results.length > 0 ? (
                <div className="result-list" ref={resultListRef}>
                  {results.map((item, index) => (
                    <div
                      key={item.row_id}
                      className={`result-item ${activeIndex === index ? "active" : ""}`}
                      onClick={() => onSelectItem(item)}
                      onMouseEnter={() => onActivate(index)}
                    >
                      <span className="result-name">{item.fields.Name}</span>
                      <span className="result-arrow">↵</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-empty">
                  <Typography.Text type="secondary">未找到相关物品，请尝试其他关键词</Typography.Text>
                </div>
              )}
            </div>
          )}
        </div>
      </Space>
    </Card>
  );
}
