import type { ReactNode } from "react";
import { Button, Dropdown, Tooltip, type MenuProps } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SyncOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import { SearchSection, type SearchSectionProps } from "./SearchSection";
import type { ThemeMode } from "../constants";

interface TopNavProps {
  search: SearchSectionProps;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemeMode;
  isDark: boolean;
  onThemeChange: (mode: ThemeMode) => void;
}

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
  auto: <SyncOutlined />,
  light: <SunOutlined />,
  dark: <MoonOutlined />,
};

const THEME_LABELS: Record<ThemeMode, string> = {
  auto: "自动",
  light: "浅色",
  dark: "深色",
};

const THEME_MENU_ITEMS: MenuProps["items"] = [
  { key: "auto", label: "跟随系统", icon: <SyncOutlined /> },
  { key: "light", label: "浅色", icon: <SunOutlined /> },
  { key: "dark", label: "深色", icon: <MoonOutlined /> },
];

/** 顶部导航栏：搜索栏居中，左侧为侧栏开关，右侧为主题选择菜单 */
export function TopNav({ search, sidebarOpen, onToggleSidebar, themeMode, isDark, onThemeChange }: TopNavProps) {
  const handleThemeMenuClick: MenuProps["onClick"] = ({ key }) => {
    onThemeChange(key as ThemeMode);
  };
  // auto 模式下图标跟随系统主题
  const effectiveTheme: ThemeMode = themeMode === "auto" ? (isDark ? "dark" : "light") : themeMode;

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-left">
          <Tooltip title={sidebarOpen ? "收起侧栏" : "展开侧栏"}>
            <Button
              type="text"
              className="sidebar-toggle"
              icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={onToggleSidebar}
            />
          </Tooltip>
        </div>
        <div className="top-nav-search">
          <SearchSection {...search} />
        </div>
        <div className="top-nav-right">
          <Tooltip title={`主题：${THEME_LABELS[themeMode]}`}>
            <Dropdown
              menu={{
                items: THEME_MENU_ITEMS,
                selectedKeys: [themeMode],
                onClick: handleThemeMenuClick,
              }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                type="text"
                className="theme-toggle"
                icon={THEME_ICONS[effectiveTheme]}
              />
            </Dropdown>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
