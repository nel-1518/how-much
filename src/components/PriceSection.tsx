import { lazy, Suspense, useState, type ReactNode } from "react";
import { Typography, Skeleton, Segmented, Row, Col, Card, Table, Empty, Tag, message, Pagination } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse } from "../types";
import { listingColumns, historyColumns, renderWorldName, formatTradeTime } from "../columns";
import type { DcName } from "../constants";
import type { DcServerMap } from "../hooks/useRegionScope";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
import { RegionSelector } from "./RegionSelector";

// 价格走势/购买建议（含 chart.js）按需加载：仅搜索后渲染时才下载对应 chunk
const StatsChart = lazy(() => import("./StatsChart").then((m) => ({ default: m.StatsChart })));

/** 移动端分页列表：每页 15 条，数据/标签变化时通过 key 重置回第一页 */
function MobilePagedList<T>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T, globalIndex: number) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const maxPage = Math.max(1, Math.ceil(items.length / 15));
  const current = Math.min(page, maxPage);
  const pageItems = items.slice((current - 1) * 15, current * 15);
  return (
    <div className="data-mobile-list">
      {pageItems.map((item, i) => renderItem(item, (current - 1) * 15 + i))}
      <Pagination simple current={current} pageSize={15} total={items.length} onChange={setPage} />
    </div>
  );
}

interface PriceSectionProps {
  selectedItem: ItemResult;
  /** 当前查询目标："中国" | 大区名 | 服务器名 */
  scope: string;
  /** 各大区记忆的已选服务器 */
  dcServer: DcServerMap;
  onScopeChange: (scope: string) => void;
  onSelectServer: (dc: DcName, world: string) => void;
  priceData: UniversalisResponse | null;
  listingsLoading: boolean;
  historyLoading: boolean;
  fetchPriceData: (id: number, region: string, name?: string, hqOnly?: boolean) => void;
  viewTab: string;
  onViewTabChange: (v: string) => void;
  onWiki: (name: string) => void;
  /** 当前是否为深色主题（统计图配色适配） */
  isDark: boolean;
}

/** 查价结果展示组件：大区/服务器选择栏 + 查价结果 / 价格走势与购买建议 */
export function PriceSection({
  selectedItem, scope, dcServer, onScopeChange, onSelectServer,
  priceData, listingsLoading, historyLoading, fetchPriceData,
  viewTab, onViewTabChange, onWiki, isDark,
}: PriceSectionProps) {
  // 只看 HQ 开关（物品存在 HQ 品质时才可用）
  const [hqOnly, setHqOnly] = useState(false);

  const canBeHq = selectedItem.canBeHq === true;

  /** 查询目标变化（"中国"/大区）：更新全局状态并重新查价 */
  const handleScopeChange = (next: string) => {
    onScopeChange(next);
    fetchPriceData(selectedItem.row_id, next, selectedItem.fields.Name, hqOnly);
  };

  /** 选择某大区下的服务器：更新全局状态并重新查价 */
  const handleSelectServer = (dc: DcName, world: string) => {
    onSelectServer(dc, world);
    fetchPriceData(selectedItem.row_id, world, selectedItem.fields.Name, hqOnly);
  };

  /** 只看 HQ 开关：切换后带 hq 参数重新请求 */
  const handleHqOnlyToggle = (checked: boolean) => {
    setHqOnly(checked);
    fetchPriceData(selectedItem.row_id, scope, selectedItem.fields.Name, checked);
  };

  const listingCard = () => (
    <Card
      title={<><ShoppingCartOutlined /> 出售列表</>}
      size="small" className="data-card"
    >
      {listingsLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} title={false} />
      ) : priceData?.listings?.length ? (
        <>
          <div className="data-table-desktop">
            <Table
              dataSource={priceData.listings} columns={listingColumns}
              rowKey={(_, i) => String(i)} size="small"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              scroll={{ x: 450 }}
              rowClassName={(_, index) => index < 3 ? "top-three-row" : ""}
            />
          </div>
          <div className="data-mobile-table">
            <MobilePagedList
              key={`${selectedItem.row_id}-${viewTab}`}
              items={priceData.listings}
              renderItem={(item, index) => (
                <div key={index} className={`data-mobile-item${index < 3 ? " top-three-row" : ""}`}>
                  <div className="data-mobile-line">
                    {renderWorldName(item.worldName)}
                    {item.hq
                      ? <Tag color="gold" className="hq-tag">HQ</Tag>
                      : <Tag className="nq-tag">NQ</Tag>}
                  </div>
                  <div className="data-mobile-line">
                    <span className="price-cell">
                      {formatPrice(item.pricePerUnit, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
                    </span>
                    <span className="data-mobile-meta">×{item.quantity} · 总计 {formatPrice(item.total, getCurrentPriceFormat())} Gil</span>
                  </div>
                </div>
              )}
            />
          </div>
        </>
      ) : <Empty description="暂无出售数据" />}
    </Card>
  );

  const historyCard = () => (
    <Card
      title={<><HistoryOutlined /> 交易历史</>}
      size="small" className="data-card"
    >
      {historyLoading ? (
        <Skeleton active paragraph={{ rows: 9 }} title={false} />
      ) : priceData?.recentHistory?.length ? (
        <>
          <div className="data-table-desktop">
            <Table
              dataSource={priceData.recentHistory} columns={historyColumns}
              rowKey={(_, i) => String(i)} size="small"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              scroll={{ x: 550 }}
            />
          </div>
          <div className="data-mobile-table">
            <MobilePagedList
              key={`${selectedItem.row_id}-${viewTab}`}
              items={priceData.recentHistory}
              renderItem={(item) => (
                <div key={item.timestamp + item.worldName + item.pricePerUnit} className="data-mobile-item">
                  <div className="data-mobile-line">
                    {renderWorldName(item.worldName)}
                    {item.hq
                      ? <Tag color="gold" className="hq-tag">HQ</Tag>
                      : <Tag className="nq-tag">NQ</Tag>}
                  </div>
                  <div className="data-mobile-line">
                    <span className="price-cell">
                      {formatPrice(item.pricePerUnit, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
                    </span>
                    <span className="data-mobile-meta">数量 ×{item.quantity}</span>
                  </div>
                  <div className="data-mobile-line data-mobile-sub">
                    <span className="data-mobile-meta">{item.buyerName}</span>
                    <span className="time-cell">{formatTradeTime(item.timestamp)}</span>
                  </div>
                </div>
              )}
            />
          </div>
        </>
      ) : <Empty description="暂无交易记录" />}
    </Card>
  );

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label} 已复制`);
    } catch {
      message.error("复制失败");
    }
  };

  return (
    <div className="price-area">
      {/* 物品标题 + 信息标签 */}
      <div className="price-header">
        <div className="price-header-left">
          <div
            className="item-name-clickable"
            onClick={() => copyToClipboard(selectedItem.fields.Name, "物品名")}
            title="点击复制物品名"
          >
            <Typography.Title level={3} style={{ margin: 0 }}>
              {selectedItem.fields.Name}
            </Typography.Title>
          </div>
          <div className="item-tags">
            <Tag
              color="blue"
              variant="outlined"
              className="info-tag"
              onClick={() => copyToClipboard(String(selectedItem.row_id), "物品 ID")}
              title="点击复制物品 ID"
            >
              <CopyOutlined /> ID: {selectedItem.row_id}
            </Tag>
            <Tag
              color="volcano"
              variant="outlined"
              className="info-tag"
              onClick={() => window.open(`https://universalis.app/market/${selectedItem.row_id}`, "_blank")}
              title="在 Universalis 上查看"
            >
              <LinkOutlined /> Universalis
            </Tag>
            <Tag
              color="purple"
              variant="outlined"
              className="info-tag"
              onClick={() => onWiki(selectedItem.fields.Name)}
              title="在 Wiki 上查看"
            >
              <LinkOutlined /> Wiki
            </Tag>
          </div>
        </div>
      </div>

      {/* 大区/服务器选择栏 */}
      <RegionSelector
        scope={scope}
        dcServer={dcServer}
        hqOnly={hqOnly}
        canBeHq={canBeHq}
        onScopeChange={handleScopeChange}
        onSelectServer={handleSelectServer}
        onHqOnlyChange={handleHqOnlyToggle}
      />

      {/* 模块一：查价结果 */}
      <section className="price-module">
        {/* 移动端：切换 tabs */}
        <div className="view-tab-bar">
          <Segmented
            value={viewTab} onChange={(v) => onViewTabChange(v as string)}
            options={[
              { label: <><ShoppingCartOutlined /> 出售列表</>, value: "listings" },
              { label: <><HistoryOutlined /> 交易历史</>, value: "history" },
            ]}
            block
          />
        </div>

        {/* 桌面端：双列 */}
        <Row gutter={[16, 16]} className="data-row-desktop">
          <Col xs={24} lg={12}>{listingCard()}</Col>
          <Col xs={24} lg={12}>{historyCard()}</Col>
        </Row>

        {/* 移动端：单列切换 */}
        <div className="data-row-mobile">
          {viewTab === "listings" && listingCard()}
          {viewTab === "history" && historyCard()}
        </div>
      </section>

      {/* 模块二：价格走势与购买建议（合并，建议历史统计来自服务端，挂单来自查价） */}
      <section className="price-module">
        <Suspense
          fallback={
            <Card className="stats-chart-card" size="small">
              <Skeleton active paragraph={{ rows: 6 }} title={false} />
            </Card>
          }
        >
          <StatsChart
            itemId={selectedItem.row_id}
            region={scope}
            canBeHq={canBeHq}
            isDark={isDark}
            listings={priceData?.listings ?? []}
            hqOnly={hqOnly}
          />
        </Suspense>
      </section>
    </div>
  );
}
