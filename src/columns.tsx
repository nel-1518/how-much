import { Tag } from "antd";
import { WORLD_TO_DC, DC_ICON_MAP } from "./constants";
import { formatPrice, getCurrentPriceFormat } from "./utils/formatPrice";

/** 渲染服务器名称 + 大区图标 */
export const renderWorldName = (worldName: string) => {
  const dc = WORLD_TO_DC[worldName];
  const icon = dc ? DC_ICON_MAP[dc] : null;
  return (
    <span className="world-name">
      {icon && <img src={icon} alt={dc} className="dc-icon" title={dc} />}
      {worldName}
    </span>
  );
};

/** 格式化交易时间（月/日 时:分） */
export const formatTradeTime = (v: number) =>
  new Date(v * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * 相对时间（xx分前）：传入 Unix 秒时间戳与「当前时间」（毫秒），
 * 用于挂单的「更新时间」。不足 1 分钟显示「刚刚」。
 */
export const formatRelativeTime = (tsSec: number, nowMs: number = Date.now()): string => {
  if (!tsSec) return "-";
  const diff = nowMs - tsSec * 1000;
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
 * 出售列表列定义。桌面端为两列并排展示，列宽收窄以适配半宽；
 * 「更新时间」基于挂单的 lastReviewTime 显示相对时间，随传入的 nowMs 刷新。
 */
export const buildListingColumns = (nowMs: number = Date.now()) => [
  {
    title: "服务器",
    dataIndex: "worldName",
    key: "worldName",
    width: 80,
    render: renderWorldName,
  },
  {
    title: "品质",
    dataIndex: "hq",
    key: "hq",
    width: 40,
    align: "center" as const,
    render: (v: boolean) =>
      v ? (
        <Tag color="gold" className="hq-tag">
          HQ
        </Tag>
      ) : (
        <Tag className="nq-tag">NQ</Tag>
      ),
  },
  {
    title: "单价",
    dataIndex: "pricePerUnit",
    key: "pricePerUnit",
    width: 104,
    render: (v: number) => (
      <span className="price-cell">
        {formatPrice(v, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
  {
    title: "数量",
    dataIndex: "quantity",
    key: "quantity",
    width: 52,
    align: "center" as const,
  },
  {
    title: "总计",
    dataIndex: "total",
    key: "total",
    width: 104,
    render: (v: number) => (
      <span className="total-cell">
        {formatPrice(v, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
  {
    title: "更新时间",
    dataIndex: "lastReviewTime",
    key: "lastReviewTime",
    width: 84,
    render: (v: number) => (
      <span className="time-cell relative-time">{formatRelativeTime(v, nowMs)}</span>
    ),
  },
];

export const historyColumns = [
  {
    title: "服务器",
    dataIndex: "worldName",
    key: "worldName",
    width: 80,
    render: renderWorldName,
  },
  {
    title: "品质",
    dataIndex: "hq",
    key: "hq",
    width: 40,
    align: "center" as const,
    render: (v: boolean) =>
      v ? (
        <Tag color="gold" className="hq-tag">
          HQ
        </Tag>
      ) : (
        <Tag className="nq-tag">NQ</Tag>
      ),
  },
  {
    title: "单价",
    dataIndex: "pricePerUnit",
    key: "pricePerUnit",
    width: 104,
    render: (v: number) => (
      <span className="price-cell">
        {formatPrice(v, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
  {
    title: "数量",
    dataIndex: "quantity",
    key: "quantity",
    width: 52,
    align: "center" as const,
  },
  {
    title: "买家",
    dataIndex: "buyerName",
    key: "buyerName",
    width: 84,
    ellipsis: true,
  },
  {
    title: "日期",
    dataIndex: "timestamp",
    key: "timestamp",
    width: 100,
    render: (v: number) => (
      <span className="time-cell">{formatTradeTime(v)}</span>
    ),
  },
];
