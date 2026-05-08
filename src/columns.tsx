import { Tag } from "antd";
import type { UniversalisListing } from "./types";

export const listingColumns = [
  {
    title: "服务器",
    dataIndex: "worldName",
    key: "worldName",
    width: 100,
    render: (v: string) => <span className="world-name">{v}</span>,
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
    sorter: (a: UniversalisListing, b: UniversalisListing) => a.pricePerUnit - b.pricePerUnit,
    defaultSortOrder: "ascend" as const,
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
    width: 90,
    render: (v: string) => <span className="world-name">{v}</span>,
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
      <span className="time-cell">
        {new Date(v * 1000).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ),
  },
];
