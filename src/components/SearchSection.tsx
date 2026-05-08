import { useRef } from "react";
import { Input, Button, Typography, Spin, Space, Tooltip, Card } from "antd";
import { SearchOutlined, SnippetsOutlined } from "@ant-design/icons";
import type { ItemResult } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";

interface SearchSectionProps {
  keyword: string;
  results: ItemResult[];
  loading: boolean;
  hasSearched: boolean;
  showResults: boolean;
  selectedItem: ItemResult | null;
  onKeywordChange: (v: string) => void;
  onSearch: (query: string) => void;
  onSelectItem: (item: ItemResult) => void;
  onPasteSearch: () => void;
  onFocus: () => void;
  onCloseResults: () => void;
}

/** 搜索框 + 自动完成结果列表组件 */
export function SearchSection({
  keyword, results, loading, hasSearched, showResults, selectedItem,
  onKeywordChange, onSearch, onSelectItem, onPasteSearch, onFocus, onCloseResults,
}: SearchSectionProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, onCloseResults);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearch(keyword);
  };

  return (
    <Card className="search-card" variant="borderless">
      <Space direction="vertical" style={{ width: "100%", maxWidth: 600 }}>
        <div ref={searchRef} style={{ position: "relative" }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              size="large"
              placeholder="输入物品名称"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              prefix={<SearchOutlined />}
              allowClear
              className="search-input"
            />
            <Tooltip title="粘贴并搜索">
              <Button size="large" icon={<SnippetsOutlined />} onClick={onPasteSearch} />
            </Tooltip>
            <Button
              size="large" type="primary" icon={<SearchOutlined />}
              onClick={() => onSearch(keyword)} loading={loading}
            >
              搜索
            </Button>
          </Space.Compact>

          {hasSearched && showResults && (
            <div className="search-results">
              {loading ? (
                <div className="search-loading"><Spin size="small" /><span>搜索中...</span></div>
              ) : results.length > 0 ? (
                <div className="result-list">
                  {results.map((item) => (
                    <div
                      key={item.row_id}
                      className={`result-item ${selectedItem?.row_id === item.row_id ? "active" : ""}`}
                      onClick={() => onSelectItem(item)}
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
