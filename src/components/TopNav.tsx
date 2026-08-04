import { Button, Tooltip } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { SearchSection, type SearchSectionProps } from "./SearchSection";

interface TopNavProps {
  search: SearchSectionProps;
  onOpenSettings: () => void;
}

/** 顶部导航栏：搜索栏居中，右侧为设置入口 */
export function TopNav({ search, onOpenSettings }: TopNavProps) {
  return (
    <header className={`top-nav${search.showResults ? " dropdown-open" : ""}`}>
      <div className="top-nav-inner">
        <div className="top-nav-spacer" aria-hidden="true" />
        <div className="top-nav-search">
          <SearchSection {...search} />
        </div>
        <Tooltip title="设置">
          <Button
            type="text"
            className="settings-trigger"
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
          />
        </Tooltip>
      </div>
    </header>
  );
}
