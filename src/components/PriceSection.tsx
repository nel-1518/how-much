import { useMemo, useState, type ReactNode } from "react";
import { Typography, Spin, Segmented, Row, Col, Card, Table, Empty, Button, Tooltip, Tag, message, Pagination } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, RedoOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse, TransactionStore } from "../types";
import { listingColumns, historyColumns, renderWorldName, formatTradeTime } from "../columns";
import { REGION_KEY } from "../constants";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
import { analyzePurchaseAdvice } from "../utils/purchaseAdvice";
import { PurchaseAdvice } from "./PurchaseAdvice";
import { StatsChart } from "./StatsChart";

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

/** 与刷新按钮完全同构的透明占位（隐藏但保留布局），保证两张卡片标题栏高度一致 */
const headerExtraSpacer = (
  <Button
    type="text"
    size="small"
    icon={<RedoOutlined />}
    className="data-card-extra-spacer"
    aria-hidden="true"
    tabIndex={-1}
  />
);

interface PriceSectionProps {
  selectedItem: ItemResult;
  region: string;
  onRegionChange: (v: string) => void;
  priceData: UniversalisResponse | null;
  priceLoading: boolean;
  fetchPriceData: (id: number, region: string, name?: string, hqOnly?: boolean) => void;
  refreshPrice: (id: number, region: string, name?: string, hqOnly?: boolean) => void;
  viewTab: string;
  onViewTabChange: (v: string) => void;
  onWiki: (name: string) => void;
  transactionStore: TransactionStore;
  /** 当前是否为深色主题（统计图配色适配） */
  isDark: boolean;
}

/** 查价结果展示组件：物品信息、出售列表、交易历史、购买建议 */
export function PriceSection({
  selectedItem, region, onRegionChange, priceData, priceLoading,
  fetchPriceData, refreshPrice, viewTab, onViewTabChange, onWiki,
  transactionStore, isDark,
}: PriceSectionProps) {
  // 只看 HQ 开关（物品存在 HQ 品质时才可用）
  const [hqOnly, setHqOnly] = useState(false);

  // 购买建议分析：使用 App 层已保存完成的 transactionStore
  const purchaseAdvice = useMemo(
    () => analyzePurchaseAdvice(transactionStore, selectedItem.row_id, priceData, hqOnly),
    [transactionStore, selectedItem.row_id, priceData, hqOnly],
  );

  const handleRegionChange = (val: string) => {
    onRegionChange(val);
    localStorage.setItem(REGION_KEY, val);
    fetchPriceData(selectedItem.row_id, val, selectedItem.fields.Name, hqOnly);
  };

  /** 只看 HQ 开关：切换后带 hq 参数重新请求 */
  const handleHqOnlyToggle = (checked: boolean) => {
    setHqOnly(checked);
    fetchPriceData(selectedItem.row_id, region, selectedItem.fields.Name, checked);
  };

  const canBeHq = selectedItem.canBeHq === true;

  const listingCard = (extraIcon = <RedoOutlined />) => (
    <Card
      title={<><ShoppingCartOutlined /> 出售列表</>}
      size="small" className="data-card"
      extra={
        <Tooltip title="刷新价格">
          <Button type="text" size="small" icon={extraIcon}
            onClick={() => refreshPrice(selectedItem.row_id, region, selectedItem.fields.Name, hqOnly)} loading={priceLoading}
          />
        </Tooltip>
      }
    >
      {priceData?.listings?.length ? (
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
      extra={headerExtraSpacer}
    >
      {priceData?.recentHistory?.length ? (
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
        <div className="region-hq-bar">
          {canBeHq && (
            <Tooltip title={hqOnly ? "取消只看 HQ，恢复全部品质" : "只看 HQ 品质的交易"}>
              <Button
                type={hqOnly ? "primary" : "default"}
                size="small"
                className="hq-only-toggle"
                onClick={() => handleHqOnlyToggle(!hqOnly)}
              >
                只看 HQ
              </Button>
            </Tooltip>
          )}
          <Segmented
            value={region} onChange={(v) => handleRegionChange(v as string)}
            options={[
              { label: <>中国</>, value: "中国" },
              { label: <>陆行鸟</>, value: "陆行鸟" },
              { label: <>莫古力</>, value: "莫古力" },
              { label: <>猫小胖</>, value: "猫小胖" },
              { label: <>豆豆柴</>, value: "豆豆柴" },
            ]}
            className="region-segmented"
          />
        </div>
      </div>

      <Spin spinning={priceLoading}>
        {priceData ? (
          <>
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
              {viewTab === "listings" && listingCard(<RedoOutlined />)}
              {viewTab === "history" && historyCard()}
            </div>

            {/* 统计图栏（购买建议上方） */}
            <StatsChart
              itemId={selectedItem.row_id}
              region={region}
              canBeHq={canBeHq}
              isDark={isDark}
            />

            {/* 购买建议 */}
            <PurchaseAdvice result={purchaseAdvice} />
          </>
        ) : (!priceLoading && <Empty description="暂无数据" />)}
      </Spin>
    </div>
  );
}
