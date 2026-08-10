import { Button, Dropdown, Space, Tooltip, type MenuProps } from "antd";
import {
  GlobalOutlined,
  DownOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { DC_ICON_MAP, DC_NAMES, DC_WORLDS, DEFAULT_REGION, type DcName } from "../constants";
import type { DcServerMap } from "../hooks/useRegionScope";

interface RegionSelectorProps {
  /** 当前查询目标："中国" | 大区名 | 服务器名 */
  scope: string;
  /** 各大区记忆的已选服务器 */
  dcServer: DcServerMap;
  /** 只看 HQ 开关 */
  hqOnly: boolean;
  /** 物品是否存在 HQ 品质（hq=0 时隐藏开关） */
  canBeHq: boolean;
  onScopeChange: (scope: string) => void;
  onSelectServer: (dc: DcName, world: string) => void;
  onHqOnlyChange: (hqOnly: boolean) => void;
}

/** 大区/服务器选择栏：「中国」按钮 + 四个大区（主按钮快速切换 + 功能菜单选服务器）+ 只看 HQ 开关 */
export function RegionSelector({
  scope, dcServer, hqOnly, canBeHq,
  onScopeChange, onSelectServer, onHqOnlyChange,
}: RegionSelectorProps) {
  const buildMenu = (dc: DcName): MenuProps => ({
    items: [
      {
        key: dc,
        label: (
          <span className="region-drop-dc-item">
            <ApartmentOutlined /> {dc}（全大区）
          </span>
        ),
      },
      { type: "divider" },
      ...DC_WORLDS[dc].map((world) => ({ key: world, label: world })),
    ],
    // 选中项在菜单列表中保持高亮（切换服务器后列表仍显示对应服务器）
    selectedKeys: [scope === dc || dcOf(scope) === dc ? scope : dcServer[dc]],
    onClick: ({ key }) => {
      if (key === dc) {
        onScopeChange(dc);
      } else {
        onSelectServer(dc, key);
      }
    },
  });

  const isActiveDc = (dc: DcName) => scope === dc || dcOf(scope) === dc;

  return (
    <div className="region-selector-bar">
      <Button
        type="default"
        size="small"
        className={`region-drop-btn china-btn${scope === DEFAULT_REGION ? " active" : ""}`}
        icon={<GlobalOutlined className="region-drop-global-icon" />}
        onClick={() => onScopeChange(DEFAULT_REGION)}
      >
        {DEFAULT_REGION}
      </Button>

      {DC_NAMES.map((dc) => {
        const active = isActiveDc(dc);
        const label = active ? scope : dcServer[dc];
        // 大区记忆的服务器名（缺省=大区名，即全大区）
        const remembered = dcServer[dc];
        const hasServer = remembered !== dc;
        // 点击主按钮：已选过服务器则查询该服务器数据，否则查询整个大区
        const handleMainClick = () => {
          if (hasServer) {
            onSelectServer(dc, remembered);
          } else {
            onScopeChange(dc);
          }
        };
        const mainTitle = active
          ? hasServer
            ? `当前查询：${scope}（点击重新查询该服务器）`
            : `当前查询：${dc}全大区（点击重新查询）`
          : hasServer
            ? `点击查询${dc}大区：${remembered}`
            : `点击切换到${dc}大区`;
        return (
          <Space.Compact key={dc} className="region-dc-compact">
            <Button
              size="small"
              className={`region-drop-btn region-dc-main${active ? " active" : ""}`}
              icon={<img src={DC_ICON_MAP[dc]} alt={dc} className="region-drop-icon" />}
              onClick={handleMainClick}
              title={mainTitle}
            >
              {label}
            </Button>
            <Dropdown
              menu={buildMenu(dc)}
              trigger={["hover"]}
              placement="bottomRight"
            >
              <Button
                size="small"
                className={`region-drop-btn region-dc-more${active ? " active" : ""}`}
                aria-label={`选择${dc}大区的服务器`}
                icon={<DownOutlined />}
              />
            </Dropdown>
          </Space.Compact>
        );
      })}

      {canBeHq && (
        <Tooltip title={hqOnly ? "取消只看 HQ，恢复全部品质" : "只看 HQ 品质的交易"}>
          <Button
            type={hqOnly ? "primary" : "default"}
            size="small"
            className="hq-only-toggle"
            onClick={() => onHqOnlyChange(!hqOnly)}
          >
            只看 HQ
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

/** scope 是否属于某大区：返回该大区下的服务器名或大区名 */
function dcOf(scope: string): DcName | undefined {
  for (const dc of DC_NAMES) {
    if (scope === dc) return dc;
    if (DC_WORLDS[dc].includes(scope)) return dc;
  }
  return undefined;
}
