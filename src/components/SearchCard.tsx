import { useEffect, useRef, useState } from "react";
import { Input, Typography, Spin, Card } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ItemResult, SearchHistoryItem } from "../types";
import { HistorySection } from "./HistorySection";

export interface SearchCardProps {
  keyword: string;
  results: ItemResult[];
  loading: boolean;
  activeIndex: number;
  history: SearchHistoryItem[];
  /** 由 Tab 打开时为 true，自动聚焦卡片内输入框 */
  focusOnMount: boolean;
  onKeywordChange: (v: string) => void;
  onSearch: (query: string) => void;
  onSelectItem: (item: ItemResult) => void;
  onSearchFromHistory: (item: SearchHistoryItem) => void;
  onRemoveHistory: (id: number) => void;
  onClearHistory: () => void;
  onTogglePin: (id: number) => void;
  onMoveActive: (delta: number) => void;
  onActivate: (index: number) => void;
  onClose: () => void;
}

/** 居中悬浮搜索卡片：输入框（与顶部同步显示）+ 搜索历史 + 搜索结果 */
export function SearchCard({
  keyword, results, loading, activeIndex, history, focusOnMount,
  onKeywordChange, onSearch, onSelectItem, onSearchFromHistory,
  onRemoveHistory, onClearHistory, onTogglePin, onMoveActive, onActivate, onClose,
}: SearchCardProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<React.ComponentRef<typeof Input>>(null);

  // 跟踪可视视口（移动端键盘弹出时可视区域会缩小），让卡片始终完整可见
  const [viewport, setViewport] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  }));

  useEffect(() => {
    const vvp = window.visualViewport;
    if (!vvp) return;
    const update = () => setViewport({ height: vvp.height, top: vvp.offsetTop });
    update();
    vvp.addEventListener("resize", update);
    vvp.addEventListener("scroll", update);
    return () => {
      vvp.removeEventListener("resize", update);
      vvp.removeEventListener("scroll", update);
    };
  }, []);

  // Tab 打开卡片时自动聚焦输入框；若已有内容则全选，方便直接替换/删除
  useEffect(() => {
    if (!focusOnMount) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.input?.value.length ?? 0;
    if (len > 0) {
      el.setSelectionRange(0, len);
    }
  }, [focusOnMount]);

  // 点击遮罩（卡片外部，且不在顶部导航栏）时关闭；Esc / Tab 由 App 全局监听处理
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t === overlayRef.current) {
        onClose();
        return;
      }
      if (overlayRef.current?.contains(t)) return;
      if (t.closest(".top-nav")) return;
      // antd 弹层（Popconfirm 等）渲染在 body 的 portal 中，不在卡片 DOM 内；
      // 点击其中的按钮（如“确定”）不应被当作点击卡片外部而关闭卡片
      if (t.closest(".ant-popover, .ant-popconfirm, .ant-dropdown, .ant-modal-wrap, .ant-message, .ant-notification")) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // 高亮项变化时，确保其在结果可视区域内（超出则同步滚动外层容器）
  useEffect(() => {
    const list = resultsRef.current;
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

  const trimmed = keyword.trim();
  const showHistory = trimmed === "";

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
    <div
      className="search-modal-overlay"
      ref={overlayRef}
      style={{
        "--vv-top": `${viewport.top}px`,
        "--vv-height": `${viewport.height}px`,
      } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="搜索物品"
    >
      <Card className="search-modal-card" variant="borderless">
        <div className="search-modal-input-row">
          <Input
            ref={inputRef}
            size="large"
            className="search-input"
            placeholder="输入物品名称"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            prefix={<SearchOutlined className="search-prefix-icon" />}
            allowClear
            autoFocus={focusOnMount}
          />
        </div>

        <div className="search-results" ref={resultsRef}>
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
            <div className="result-list">
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
      </Card>
    </div>
  );
}
