import type { ReactNode } from "react";
import { Tag } from "antd";
import { LikeOutlined } from "@ant-design/icons";
import { WORLD_TO_DC, DC_ICON_MAP } from "./constants";
import { formatPrice, getCurrentPriceFormat, withMarketTax } from "./utils/formatPrice";
import type { UniversalisListing, UniversalisHistory } from "./types";

/** 渲染服务器名称 + 大区图标（名称用 antd Tag；染色行里以服务器色相显示为 outlined 标签） */
export const renderWorldName = (worldName: string) => {
  const dc = WORLD_TO_DC[worldName];
  const icon = dc ? DC_ICON_MAP[dc] : null;
  return (
    <span className="world-name">
      {icon && <img src={icon} alt={dc} className="dc-icon" title={dc} />}
      <Tag variant="outlined" className="world-tag">
        {worldName}
      </Tag>
    </span>
  );
};

/** 品质标签（HQ / NQ） */
export const renderQualityTag = (hq: boolean) =>
  hq ? (
    <Tag color="gold" className="hq-tag">
      HQ
    </Tag>
  ) : (
    <Tag className="nq-tag">NQ</Tag>
  );

/** 服装模特来源标记：买家名左侧的图标标签 */
export const renderMannequinTag = () => (
  <Tag color="gold" className="mannequin-tag" title="从服装模特购买">
    <LikeOutlined />
  </Tag>
);

/** 交易历史买家单元格：从服装模特购买时，名称左侧标注图标 */
export const renderBuyer = (h: UniversalisHistory) => (
  <span className="buyer-cell">
    {h.onMannequin === true && renderMannequinTag()}
    {h.buyerName}
  </span>
);

/** 单价单元格 */
const renderPrice = (v: number) => (
  <span className="price-cell">
    {formatPrice(v, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
  </span>
);

/** 总计单元格 */
const renderTotal = (v: number) => (
  <span className="total-cell">
    {formatPrice(v, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
  </span>
);

/** 格式化交易时间（月/日 时:分） */
export const formatTradeTime = (v: number) =>
  new Date(v * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * 相对时间（xx分前）：传入 Unix 时间戳（秒或毫秒自动识别）与「当前时间」（毫秒），
 * 用于挂单的「更新时间」与批量查价的「更新时间」。不足 1 分钟显示「刚刚」。
 */
export const formatRelativeTime = (ts: number, nowMs: number = Date.now()): string => {
  if (!ts) return "-";
  const tsMs = ts > 1e12 ? ts : ts * 1000; // 兼容秒 / 毫秒时间戳
  const diff = nowMs - tsMs;
  if (diff < 60_000) return "刚刚";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}天前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}个月前`;
  return `${Math.floor(month / 12)}年前`;
};

/**
 * 两列网格中的一列字段定义：width 为 CSS grid 轨道宽度（如 "1.4fr"），
 * 两列共用同一套字段与宽度，从而与顶部共享表头严格对齐。
 */
export interface GridField<T> {
  title: string;
  width: string;
  align?: "left" | "center" | "right";
  render: (record: T) => ReactNode;
}

/** 出售列表字段（桌面端两列网格用）；taxed=true 时单价/总计展示税后价（×105% 向下取整） */
export const listingFields = (
  nowMs: number = Date.now(),
  taxed = false,
): GridField<UniversalisListing>[] => {
  const price = (v: number) => (taxed ? withMarketTax(v) : v);
  return [
    { title: "服务器", width: "minmax(100px, 1.1fr)", render: (l) => renderWorldName(l.worldName) },
    { title: "品质", width: "minmax(54px, 0.7fr)", align: "center", render: (l) => renderQualityTag(l.hq) },
    { title: "单价", width: "1.5fr", render: (l) => renderPrice(price(l.pricePerUnit)) },
    { title: "数量", width: "0.7fr", align: "center", render: (l) => l.quantity },
    { title: "总计", width: "1.5fr", render: (l) => renderTotal(price(l.total)) },
    {
      title: "更新时间",
      width: "1.1fr",
      render: (l) => (
        <span className="time-cell relative-time">{formatRelativeTime(l.lastReviewTime ?? 0, nowMs)}</span>
      ),
    },
  ];
};

/** 交易历史字段（桌面端两列网格用） */
export const historyFields = (): GridField<UniversalisHistory>[] => [
  { title: "服务器", width: "minmax(100px, 1.1fr)", render: (h) => renderWorldName(h.worldName) },
  { title: "品质", width: "minmax(54px, 0.7fr)", align: "center", render: (h) => renderQualityTag(h.hq) },
  { title: "单价", width: "1.8fr", render: (h) => renderPrice(h.pricePerUnit) },
  { title: "数量", width: "0.7fr", align: "center", render: (h) => h.quantity },
  { title: "买家", width: "1.2fr", render: (h) => renderBuyer(h) },
  {
    title: "日期",
    width: "minmax(100px, 1.1fr)",
    render: (h) => <span className="time-cell">{formatTradeTime(h.timestamp)}</span>,
  },
];

/**
 * 为「当前列表显示的服务器」动态生成 OKLCH 色相（0–360）：
 * - 只统计传入的这批服务器（当前可见数据），数量少、彼此易区分，无需固定色板；
 * - 按服务器在列表中「首次出现的先后」分配：靠前的先拿色（起始色相与主题主色同向）；
 * - 色相用黄金角递推 hᵢ = (h₀ + i × 137.508°) mod 360°，让靠前的服务器尽量拉开，
 *   靠后的颜色即使相近也没关系；
 * - 亮度 / 彩度不在这里定，交给 CSS 按明暗主题设定，从而保持清淡柔和。
 */
const GOLDEN_ANGLE = 137.508;
const START_HUE = 310; // 起始色相：与主题主色（紫）同向

export function buildServerHueMap(worldNames: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const world of worldNames) {
    if (!world || map.has(world)) continue; // 首次出现即分配，后续重复忽略
    map.set(world, (START_HUE + map.size * GOLDEN_ANGLE) % 360);
  }
  return map;
}
