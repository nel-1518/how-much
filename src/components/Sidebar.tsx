import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Button, Space } from "antd";
import { SettingOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { MIN_SIDEBAR_W, MAX_SIDEBAR_W } from "../constants";
import { useSidebar } from "../contexts/SidebarContext";
import { useDialogs } from "../contexts/DialogsContext";
import { isEditableTarget } from "../utils/dom";

interface SidebarProps {
  /** 无障碍标签 */
  ariaLabel: string;
  /** 标题（含图标） */
  title: ReactNode;
  /** 标题右侧的操作按钮 */
  headerActions?: ReactNode;
  /** 列表容器引用（供调用方滚动到指定条目） */
  listRef?: RefObject<HTMLDivElement | null>;
  /** 列表内容 */
  children: ReactNode;
}

/**
 * 通用左侧栏骨架：标题、列表、底部设置/关于、拖拽调宽与 ` 快捷键。
 * 主页（搜索历史）与批量查价页（物品集）共用同一份开合与宽度配置。
 */
export function Sidebar({ ariaLabel, title, headerActions, listRef, children }: SidebarProps) {
  const { open, width, resizeStart, resize, resizeEnd, toggle } = useSidebar();
  const { settingsOpen, infoOpen, openSettings, openInfo } = useDialogs();

  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // ` 键开关侧栏（输入控件内不拦截，避免影响正常输入；弹窗打开时不响应）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "`") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (settingsOpen || infoOpen) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, infoOpen, toggle]);

  /** 按住右边缘拖拽调整宽度，限制在 MIN/MAX 之间 */
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    resizeStart();

    const handleMove = (ev: PointerEvent) => {
      const next = Math.min(
        MAX_SIDEBAR_W,
        Math.max(MIN_SIDEBAR_W, startWidth + (ev.clientX - startX)),
      );
      widthRef.current = next;
      resize(next);
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      resizeEnd(widthRef.current);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <aside className={`app-sidebar${open ? " open" : ""}`} aria-label={ariaLabel}>
      <div className="sidebar-header">
        <span className="sidebar-title">{title}</span>
        <Space size={2}>{headerActions}</Space>
      </div>

      <div className="sidebar-list" ref={listRef}>
        {children}
      </div>

      <div className="sidebar-footer">
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={openSettings}
        >
          设置
        </Button>
        <Button
          type="text"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={openInfo}
        >
          关于
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
