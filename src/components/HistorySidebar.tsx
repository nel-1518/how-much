import { useEffect, useRef } from "react";
import { Button, Empty, Popconfirm } from "antd";
import {
  ClockCircleOutlined,
  ClearOutlined,
  PushpinOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { SearchHistoryItem } from "../types";
import { useSidebar } from "../contexts/SidebarContext";
import { useSearchHistoryContext } from "../contexts/SearchHistoryContext";
import { Sidebar } from "./Sidebar";

/** 左侧历史侧栏：固定历史 + 最近搜索列表，点击条目直接切换查价 */
export function HistorySidebar() {
  const { close } = useSidebar();
  const { sortedHistory, activeItemId, searchFromHistory, removeHistory, clearHistory, togglePin } =
    useSearchHistoryContext();

  const listRef = useRef<HTMLDivElement>(null);

  // 当前物品变化时，将其滚动到可见区域
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(".sidebar-item.active");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeItemId]);

  const handleSelect = (item: SearchHistoryItem) => {
    if (item.id !== activeItemId) {
      searchFromHistory(item);
    }
    // 移动端选择后自动收起，桌面端保持展开方便连续浏览
    if (window.innerWidth <= 768) close();
  };

  return (
    <Sidebar
      ariaLabel="搜索历史"
      title={<><ClockCircleOutlined /> 搜索历史</>}
      listRef={listRef}
      headerActions={
        sortedHistory.length > 0 && (
          <Popconfirm
            title="确定清空全部搜索历史？"
            onConfirm={clearHistory}
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
        )
      }
    >
      {sortedHistory.length === 0 ? (
        <div className="sidebar-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无搜索历史" />
        </div>
      ) : (
        sortedHistory.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item${item.pinned ? " pinned" : ""}${item.id === activeItemId ? " active" : ""}`}
            onClick={() => handleSelect(item)}
          >
            {item.pinned && <PushpinOutlined className="sidebar-pin-icon" />}
            <span className="sidebar-item-name" title={item.name}>{item.name}</span>
            <span className="sidebar-item-actions">
              <Button
                type="text"
                size="small"
                icon={<PushpinOutlined />}
                title={item.pinned ? "取消固定" : "固定到最前"}
                className="sidebar-item-btn"
                onClick={(e) => { e.stopPropagation(); togglePin(item.id); }}
              />
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                title="删除"
                className="sidebar-item-btn"
                onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
              />
            </span>
          </div>
        ))
      )}
    </Sidebar>
  );
}
