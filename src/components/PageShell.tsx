import type { ReactNode } from "react";
import { Alert, Button } from "antd";
import { TopNav } from "./TopNav";
import type { SearchSectionProps } from "./SearchSection";
import { SettingsDialog } from "./SettingsDialog";
import { InfoDialog } from "./InfoDialog";
import { useSidebar } from "../contexts/SidebarContext";
import { useDialogs } from "../contexts/DialogsContext";
import { useItemDb } from "../contexts/ItemDbContext";

interface PageShellProps {
  /** 顶部搜索栏配置；未提供时不显示搜索框（批量查价页） */
  search?: SearchSectionProps;
  /** 左侧栏内容（主页：搜索历史；批量查价页：物品集） */
  sidebar: ReactNode;
  /** 附加到 app-container 的类名（如 "searched" / "searched batch-mode"） */
  containerClassName?: string;
  /** app-container 之外、app-shell 之内的浮层（如搜索卡片） */
  overlay?: ReactNode;
  /** 内容区 */
  children: ReactNode;
}

/**
 * 页面骨架：app-shell 容器 + 顶部导航 + 左侧栏 + 内容区 + 全局弹窗。
 * 主页与批量查价页共用此骨架，侧栏的开合与宽度来自同一份配置（SidebarContext）。
 */
export function PageShell({ search, sidebar, containerClassName = "", overlay, children }: PageShellProps) {
  const {
    open: sidebarOpen,
    width: sidebarWidth,
    resizing: sidebarResizing,
    close: closeSidebar,
  } = useSidebar();
  const { settingsOpen, infoOpen, closeSettings, closeInfo } = useDialogs();
  const itemDb = useItemDb();

  return (
    <div
      className={`app-shell${sidebarOpen ? " sidebar-open" : ""}${sidebarResizing ? " resizing" : ""}`}
      style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <TopNav search={search} />

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}

      {sidebar}

      {overlay}

      <div className={`app-container${containerClassName ? ` ${containerClassName}` : ""}`}>
        {itemDb.status === "error" && (
          <Alert
            message="物品数据库加载失败"
            description={itemDb.errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 16, width: "100%", maxWidth: 800 }}
            action={<Button size="small" onClick={() => window.location.reload()}>刷新页面</Button>}
          />
        )}

        {children}

        <SettingsDialog open={settingsOpen} onClose={closeSettings} />
        <InfoDialog open={infoOpen} onClose={closeInfo} itemDbVersion={itemDb.version} />
      </div>
    </div>
  );
}
