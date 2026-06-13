import { useMemo } from "react";
import { Typography, Spin, Segmented, Row, Col, Card, Table, Empty, Button, Tooltip, Tag, message } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, RedoOutlined, BarChartOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse } from "../types";
import type { PriceStats } from "../utils/computeStats";
import { computeStats } from "../utils/computeStats";
import { fmtPrice } from "../utils/formatPrice";
import { listingColumns, historyColumns } from "../columns";
import { REGION_KEY } from "../constants";

interface PriceSectionProps {
  selectedItem: ItemResult;
  region: string;
  onRegionChange: (v: string) => void;
  priceData: UniversalisResponse | null;
  priceLoading: boolean;
  fetchPriceData: (id: number, region: string) => void;
  refreshPrice: (id: number, region: string) => void;
  viewTab: string;
  onViewTabChange: (v: string) => void;
  onWiki: (name: string) => void;
  isPureIdSearch?: boolean;
}

/** 查价结果展示组件：物品信息、出售列表、交易历史、行情概览 */
export function PriceSection({
  selectedItem, region, onRegionChange, priceData, priceLoading,
  fetchPriceData, refreshPrice, viewTab, onViewTabChange, onWiki,
  isPureIdSearch = false,
}: PriceSectionProps) {
  const stats: PriceStats = useMemo(() => computeStats(priceData), [priceData]);

  const handleRegionChange = (val: string) => {
    onRegionChange(val);
    localStorage.setItem(REGION_KEY, val);
    fetchPriceData(selectedItem.row_id, val);
  };

  const listingCard = (extraIcon = <RedoOutlined />) => (
    <Card
      title={<><ShoppingCartOutlined /> 出售列表</>}
      size="small" className="data-card"
      extra={
        <Tooltip title="刷新价格">
          <Button type="text" size="small" icon={extraIcon}
            onClick={() => refreshPrice(selectedItem.row_id, region)} loading={priceLoading}
          />
        </Tooltip>
      }
    >
      {priceData?.listings?.length ? (
        <Table
          dataSource={priceData.listings} columns={listingColumns}
          rowKey={(_, i) => String(i)} size="small"
          pagination={{ pageSize: 15, showSizeChanger: false }}
          scroll={{ x: 450 }}
          rowClassName={(_, index) => index < 3 ? "top-three-row" : ""}
        />
      ) : <Empty description="暂无出售数据" />}
    </Card>
  );

  const historyCard = () => (
    <Card title={<><HistoryOutlined /> 交易历史</>} size="small" className="data-card">
      {priceData?.recentHistory?.length ? (
        <Table
          dataSource={priceData.recentHistory} columns={historyColumns}
          rowKey={(_, i) => String(i)} size="small"
          pagination={{ pageSize: 15, showSizeChanger: false }}
          scroll={{ x: 550 }}
        />
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
        <div className="item-info-group">
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
            {!isPureIdSearch && (
              <Tag
                color="purple"
                variant="outlined"
                className="info-tag"
                onClick={() => onWiki(selectedItem.fields.Name)}
                title="在 Wiki 上查看"
              >
                <LinkOutlined /> Wiki
              </Tag>
            )}
          </div>
        </div>
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

            {/* 行情概览 */}
            {stats.listingCount > 0 && (
              <Card title={<><BarChartOutlined /> 行情概览</>} size="small" className="stats-overview-card">
                <Row gutter={[16, 12]}>
                  <Col xs={12} sm={8} md={6}>
                    <div className="so-item"><div className="so-label">最低单价</div>
                      <div className="so-value so-low">{fmtPrice(stats.lowestPrice)}</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <Tooltip title={`原始均价：${stats.avgPrice.toLocaleString()} Gil（含极端值）`}>
                      <div className="so-item">
                        <div className="so-label">截尾均价<span className="so-label-hint"> 10%</span></div>
                        <div className="so-value">{fmtPrice(stats.trimmedMeanPrice)}</div>
                      </div>
                    </Tooltip>
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <div className="so-item"><div className="so-label">中位数单价</div>
                      <div className="so-value">{fmtPrice(stats.medianPrice)}</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <div className="so-item"><div className="so-label">近期成交均价</div>
                      <div className="so-value">
                        {stats.recentAvgPrice > 0 ? fmtPrice(stats.recentAvgPrice) : <span className="so-na">暂无</span>}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            )}
          </>
        ) : (!priceLoading && <Empty description="暂无数据" />)}
      </Spin>
    </div>
  );
}
