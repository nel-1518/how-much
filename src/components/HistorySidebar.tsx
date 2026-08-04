import { useEffect, useRef } from "react";
import { Button, Empty, Popconfirm, Space, Tooltip } from "antd";
import {
  ClockCircleOutlined,
  ClearOutlined,
  PushpinOutlined,
  DeleteOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { MIN_SIDEBAR_W, MAX_SIDEBAR_W } from "../constants";
import type { SearchHistoryItem } from "../types";

interface HistorySidebarProps {
  open: boolean;
  width: number;
  sortedHistory: SearchHistoryItem[];
  /** 当前正在查看的物品 ID，用于高亮 */
  activeItemId: number | null;
  onSearchFromHistory: (item: SearchHistoryItem) => void;
  onRemoveHistory: (id: number) => void;
  onClearHistory: () => void;
  onTogglePin: (id: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenInfo: () => void;
  onResizeStart: () => void;
  onResize: (width: number) => void;
  onResizeEnd: (width: number) => void;
}

/** 左侧历史侧栏：固定历史 + 最近搜索列表，点击条目直接切换查价 */
export function HistorySidebar({
  open,
  width,
  sortedHistory,
  activeItemId,
  onSearchFromHistory,
  onRemoveHistory,
  onClearHistory,
  onTogglePin,
  onClose,
  onOpenSettings,
  onOpenInfo,
  onResizeStart,
  onResize,
  onResizeEnd,
}: HistorySidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // 当前物品变化时，将其滚动到可见区域
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(".sidebar-history-item.active");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeItemId, open]);

  const handleSelect = (item: SearchHistoryItem) => {
    if (item.id !== activeItemId) {
      onSearchFromHistory(item);
    }
    // 移动端选择后自动收起，桌面端保持展开方便连续浏览
    if (window.innerWidth <= 768) onClose();
  };

  /** 按住右边缘拖拽调整宽度，限制在 MIN/MAX 之间 */
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    onResizeStart();

    const handleMove = (ev: PointerEvent) => {
      const next = Math.min(
        MAX_SIDEBAR_W,
        Math.max(MIN_SIDEBAR_W, startWidth + (ev.clientX - startX)),
      );
      widthRef.current = next;
      onResize(next);
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onResizeEnd(widthRef.current);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <aside className={`history-sidebar${open ? " open" : ""}`} aria-label="搜索历史">
      <div className="sidebar-header">
        <span className="sidebar-title">
          <ClockCircleOutlined /> 搜索历史
        </span>
        <Space size={2}>
          {sortedHistory.length > 0 && (
            <Popconfirm
              title="确定清空全部搜索历史？"
              onConfirm={onClearHistory}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                className="sidebar-header-btn"
                title="清空历史"
              />
            </Popconfirm>
          )}
        </Space>
      </div>

      <div className="sidebar-history-list" ref={listRef}>
        {sortedHistory.length === 0 ? (
          <div className="sidebar-history-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无搜索历史" />
          </div>
        ) : (
          sortedHistory.map((item) => (
            <div
              key={item.id}
              className={`sidebar-history-item${item.pinned ? " pinned" : ""}${item.id === activeItemId ? " active" : ""}`}
              onClick={() => handleSelect(item)}
            >
              {item.pinned && <PushpinOutlined className="sidebar-pin-icon" />}
              <span className="sidebar-history-name" title={item.name}>{item.name}</span>
              <span className="sidebar-history-actions">
                <Tooltip title={item.pinned ? "取消固定" : "固定到最前"}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PushpinOutlined />}
                    className="sidebar-item-btn"
                    onClick={(e) => { e.stopPropagation(); onTogglePin(item.id); }}
                  />
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    className="sidebar-item-btn"
                    onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.id); }}
                  />
                </Tooltip>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={onOpenSettings}
        >
          设置
        </Button>
        <Button
          type="text"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={onOpenInfo}
        >
          信息
        </Button>
      </div>

      <div
        className="sidebar-resizer"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧栏宽度"
      />
    </aside>
  );
}
