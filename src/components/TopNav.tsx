import { Button, Segmented } from "antd";
import { useLocation, useNavigate } from "react-router";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { SearchSection, type SearchSectionProps } from "./SearchSection";
import { useSidebar } from "../contexts/SidebarContext";
import { MARKET_PATH } from "../constants";
import type { ViewMode } from "../types";

interface TopNavProps {
  /** 顶部搜索栏配置；批量查价页不提供（不显示搜索框） */
  search?: SearchSectionProps;
}

/** 顶部导航栏：搜索栏居中，左侧为侧栏开关（及返回主页），右侧为视图切换 */
export function TopNav({ search }: TopNavProps) {
  const { open: sidebarOpen, toggle: onToggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  // 当前视图由路由决定：/batch 为批量查价，其余为单个查价
  const viewMode: ViewMode = location.pathname.startsWith("/batch") ? "batch" : "single";
  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <div className="top-nav-left">
          <Button
            type="text"
            className="sidebar-toggle"
            icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
            onClick={onToggleSidebar}
          />
          <Button
            type="text"
            className="sidebar-toggle home-btn"
            icon={<HomeOutlined />}
            title="返回主页"
            aria-label="返回主页"
            onClick={() => navigate(MARKET_PATH)}
          />
        </div>
        <div className="top-nav-search">
          {search ? <SearchSection {...search} /> : <div></div>}
        </div>
        <div className="top-nav-right">
          <Segmented
            size="small"
            className="view-mode-seg"
            value={viewMode}
            onChange={(v) => navigate(v === "batch" ? "/batch" : MARKET_PATH)}
            options={[
              { label: <span><SearchOutlined /><span className="seg-label">单个查价</span></span>, value: "single" },
              { label: <span><UnorderedListOutlined /><span className="seg-label">批量查价</span></span>, value: "batch" },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
