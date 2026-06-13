import { useMemo, useCallback } from "react";
import { Typography, Spin, Segmented, Row, Col, Card, Table, Empty, Button, Tooltip, Tag, message } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, RedoOutlined, CopyOutlined, LinkOutlined, PlusOutlined, CheckOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse, TransactionStore, CustomItemStore } from "../types";
import { listingColumns, historyColumns } from "../columns";
import { REGION_KEY } from "../constants";
import { analyzePurchaseAdvice } from "../utils/purchaseAdvice";
import { PurchaseAdvice } from "./PurchaseAdvice";

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
  transactionStore: TransactionStore;
  customItems: CustomItemStore;
  onCustomItemsChange: (items: CustomItemStore) => void;
}

/** 查价结果展示组件：物品信息、出售列表、交易历史、购买建议 */
export function PriceSection({
  selectedItem, region, onRegionChange, priceData, priceLoading,
  fetchPriceData, refreshPrice, viewTab, onViewTabChange, onWiki,
  transactionStore, customItems, onCustomItemsChange,
}: PriceSectionProps) {
  // 购买建议分析：使用 App 层已保存完成的 transactionStore
  const purchaseAdvice = useMemo(
    () => analyzePurchaseAdvice(transactionStore, selectedItem.row_id, priceData),
    [transactionStore, selectedItem.row_id, priceData],
  );

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

  const isCustomItem = Boolean(customItems[String(selectedItem.row_id)]);

  const handleAddToCustom = useCallback(() => {
    const id = selectedItem.row_id;
    if (customItems[String(id)]) {
      message.info("该物品已在自定义列表中");
      return;
    }
    const newItems = {
      ...customItems,
      [id]: { name: selectedItem.fields.Name, itemId: id, addedTime: Date.now() },
    };
    onCustomItemsChange(newItems);
    message.success(`「${selectedItem.fields.Name}」已添加至自定义物品`);
  }, [customItems, onCustomItemsChange, selectedItem]);

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
            <Tooltip title={isCustomItem ? "已在自定义列表中" : "添加到自定义物品"}>
              <Tag
                color={isCustomItem ? "green" : "cyan"}
                variant={isCustomItem ? "filled" : "outlined"}
                className="info-tag"
                onClick={handleAddToCustom}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                {isCustomItem ? <CheckOutlined /> : <PlusOutlined />}
              </Tag>
            </Tooltip>
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

            {/* 购买建议 */}
            <PurchaseAdvice result={purchaseAdvice} />
          </>
        ) : (!priceLoading && <Empty description="暂无数据" />)}
      </Spin>
    </div>
  );
}
