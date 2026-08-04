import { Tag } from "antd";
import { WORLD_TO_DC, DC_ICON_MAP } from "./constants";

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

export const listingColumns = [
  {
    title: "服务器",
    dataIndex: "worldName",
    key: "worldName",
    width: 110,
    render: renderWorldName,
  },
  {
    title: "品质",
    dataIndex: "hq",
    key: "hq",
    width: 56,
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
    width: 120,
    render: (v: number) => (
      <span className="price-cell">
        {v.toLocaleString()} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
  {
    title: "数量",
    dataIndex: "quantity",
    key: "quantity",
    width: 64,
    align: "center" as const,
  },
  {
    title: "总计",
    dataIndex: "total",
    key: "total",
    width: 110,
    render: (v: number) => (
      <span className="total-cell">
        {v.toLocaleString()} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
];

export const historyColumns = [
  {
    title: "服务器",
    dataIndex: "worldName",
    key: "worldName",
    width: 100,
    render: renderWorldName,
  },
  {
    title: "品质",
    dataIndex: "hq",
    key: "hq",
    width: 56,
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
    width: 110,
    render: (v: number) => (
      <span className="price-cell">
        {v.toLocaleString()} <span className="gil-suffix">Gil</span>
      </span>
    ),
  },
  {
    title: "数量",
    dataIndex: "quantity",
    key: "quantity",
    width: 56,
    align: "center" as const,
  },
  {
    title: "买家",
    dataIndex: "buyerName",
    key: "buyerName",
    width: 110,
    ellipsis: true,
  },
  {
    title: "日期",
    dataIndex: "timestamp",
    key: "timestamp",
    width: 130,
    render: (v: number) => (
      <span className="time-cell">{formatTradeTime(v)}</span>
    ),
  },
];
