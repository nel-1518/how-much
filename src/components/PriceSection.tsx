import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Typography, Skeleton, Card, Empty, Tag, Button, message, Pagination, Space } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, CopyOutlined, LinkOutlined, SwapOutlined, CalculatorOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse } from "../types";
import { listingFields, historyFields, buildServerHueMap, renderWorldName, formatTradeTime, renderMannequinTag, type GridField } from "../columns";
import { useRegionScopeContext } from "../contexts/RegionScopeContext";
import { formatPrice, getCurrentPriceFormat, withMarketTax } from "../utils/formatPrice";
import { storage } from "../storage";
import { RegionSelector } from "./RegionSelector";

// 价格走势/购买建议（含 chart.js）按需加载：仅搜索后渲染时才下载对应 chunk
const StatsChart = lazy(() => import("./StatsChart").then((m) => ({ default: m.StatsChart })));

/**
 * 移动端分页列表：每页 15 条，数据/标签变化时通过 key 重置回第一页。
 * groupKey 存在时，按「当前页显示的服务器」动态算出色相并回传给 renderItem。
 */
function MobilePagedList<T>({ items, renderItem, groupKey }: {
  items: T[];
  renderItem: (item: T, globalIndex: number, hue?: number) => ReactNode;
  groupKey?: (item: T) => string;
}) {
  const [page, setPage] = useState(1);
  const maxPage = Math.max(1, Math.ceil(items.length / 15));
  const current = Math.min(page, maxPage);
  const pageItems = items.slice((current - 1) * 15, current * 15);
  // 只统计本页出现的服务器：颜色数量少、彼此更易区分
  const hueMap = groupKey ? buildServerHueMap(pageItems.map(groupKey)) : null;
  return (
    <div className="data-mobile-list">
      {pageItems.map((item, i) => {
        const gi = (current - 1) * 15 + i;
        const hue = hueMap && groupKey ? hueMap.get(groupKey(item)) : undefined;
        return renderItem(item, gi, hue);
      })}
      <Pagination current={current} pageSize={15} total={items.length} onChange={setPage} />
    </div>
  );
}

/** 桌面端两列网格：单一共享表头 + 两列数据（默认每列 15 条，一页 30 条） */
const ROWS_PER_COLUMN = 15;

function TwoColumnGrid<T extends object>({
  items,
  fields,
  rowKey,
  rowClassName,
  groupKey,
}: {
  items: T[];
  fields: GridField<T>[];
  rowKey: (record: T) => string;
  rowClassName?: (record: T, globalIndex: number) => string;
  /** 分组键（如服务器名）：按「当前页显示的服务器」动态生成色条色相 */
  groupKey?: (record: T) => string;
}) {
  const [page, setPage] = useState(1);
  const perPage = ROWS_PER_COLUMN * 2;
  const maxPage = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, maxPage);
  const start = (current - 1) * perPage;
  const left = items.slice(start, start + ROWS_PER_COLUMN);
  const right = items.slice(start + ROWS_PER_COLUMN, start + perPage);
  const template = fields.map((f) => f.width).join(" ");
  const alignClass = (a?: string) => (a ? ` align-${a}` : "");
  // 只统计当前页（两列合计）出现的服务器：颜色数量少、彼此更易区分
  const hueMap = groupKey ? buildServerHueMap([...left, ...right].map(groupKey)) : null;

  /** 渲染其中一列；offset 为全局序号偏移，用于行高亮 */
  const renderColumn = (data: T[], offset: number) => (
    <div className="data-col">
      {data.map((record, i) => {
        const gi = offset + i;
        const hue = hueMap && groupKey ? hueMap.get(groupKey(record)) : undefined;
        const style = {
          gridTemplateColumns: template,
          ...(hue !== undefined ? { "--server-hue": String(hue) } : {}),
        } as CSSProperties;
        return (
          <div
            key={rowKey(record)}
            className={`data-row${rowClassName ? ` ${rowClassName(record, gi)}` : ""}${hue !== undefined ? " server-colored" : ""}`}
            style={style}
          >
            {fields.map((f, ci) => (
              <div key={ci} className={`data-cell${alignClass(f.align)}`}>{f.render(record)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="data-two-col">
      {/* 单一共享表头：横跨两列，内部按同样的列宽分成两个半区 */}
      <div className="data-two-col-head">
        {[0, 1].map((side) => (
          <div key={side} className="data-head" style={{ gridTemplateColumns: template }}>
            {fields.map((f, ci) => (
              <div key={ci} className={`data-head-cell${alignClass(f.align)}`}>{f.title}</div>
            ))}
          </div>
        ))}
      </div>
      {renderColumn(left, start)}
      {renderColumn(right, start + ROWS_PER_COLUMN)}
      {items.length > perPage && (
        <Pagination
          className="data-two-col-pagination"
          current={current}
          pageSize={perPage}
          total={items.length}
          onChange={setPage}
          showSizeChanger={false}
        />
      )}
    </div>
  );
}

interface PriceSectionProps {
  selectedItem: ItemResult;
  priceData: UniversalisResponse | null;
  listingsLoading: boolean;
  historyLoading: boolean;
  /** 出售列表最近一次请求是否失败 */
  listingsError: boolean;
  /** 交易历史最近一次请求是否失败 */
  historyError: boolean;
  /** 出售列表中被过滤的服装模特挂单数量 */
  filteredMannequinCount: number;
  fetchPriceData: (id: number, region: string, name?: string, hqOnly?: boolean) => void;
  /** 交易历史懒加载：点击标题栏「交易历史」按钮时请求 */
  fetchPriceHistory: (id: number, region: string) => void;
  viewTab: string;
  onViewTabChange: (v: string) => void;
  onWiki: (name: string) => void;
}

/** 查价结果展示组件：大区/服务器选择栏 + 查价结果 / 价格走势与购买建议 */
export function PriceSection({
  selectedItem,
  priceData, listingsLoading, historyLoading, listingsError, historyError,
  filteredMannequinCount,
  fetchPriceData, fetchPriceHistory,
  viewTab, onViewTabChange, onWiki,
}: PriceSectionProps) {
  const { scope } = useRegionScopeContext();
  // 只看 HQ 开关（物品存在 HQ 品质时才可用）
  const [hqOnly, setHqOnly] = useState(false);
  // 税率开关：开启后单价/总计展示税后价（×105% 向下取整）；状态持久化，对所有物品查询生效
  const [taxed, setTaxed] = useState(() => storage.marketTax.load());
  // 相对时间（xx分前）定时刷新：每 30 秒更新一次基准时间
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const listingCols = useMemo(() => listingFields(nowTs, taxed), [nowTs, taxed]);
  const historyCols = useMemo(() => historyFields(), []);

  const canBeHq = selectedItem.canBeHq === true;
  // 当前展示：出售列表 / 交易历史（交易历史由标题栏按钮切换并懒加载）
  const showHistory = viewTab === "history";

  /** 查询目标变化（"中国"/大区/服务器）：RegionSelector 写入 RegionScopeContext 后在此响应并重新查价；
   *  若正在看历史则同步刷新历史。首次挂载跳过（选物品时已由 useItemSearch 发起查价）。 */
  const prevScopeRef = useRef(scope);
  useEffect(() => {
    if (prevScopeRef.current === scope) return;
    prevScopeRef.current = scope;
    fetchPriceData(selectedItem.row_id, scope, selectedItem.fields.Name, hqOnly);
    if (showHistory) fetchPriceHistory(selectedItem.row_id, scope);
  }, [scope, selectedItem, hqOnly, showHistory, fetchPriceData, fetchPriceHistory]);

  /** 只看 HQ 开关：切换后带 hq 参数重新请求（不影响交易历史接口） */
  const handleHqOnlyToggle = (checked: boolean) => {
    setHqOnly(checked);
    fetchPriceData(selectedItem.row_id, scope, selectedItem.fields.Name, checked);
  };

  /** 标题栏「交易历史」按钮：切换展示，首次点击时懒加载历史数据 */
  const handleToggleHistory = () => {
    if (showHistory) {
      onViewTabChange("listings");
    } else {
      onViewTabChange("history");
      fetchPriceHistory(selectedItem.row_id, scope);
    }
  };

  /** 出售列表请求失败后重新获取 */
  const retryListings = () => {
    fetchPriceData(selectedItem.row_id, scope, selectedItem.fields.Name, hqOnly);
  };

  /** 交易历史请求失败后重新获取 */
  const retryHistory = () => {
    fetchPriceHistory(selectedItem.row_id, scope);
  };

  /** 数据获取失败占位：提示 + 重新获取按钮 */
  const fetchError = (description: string, onRetry: () => void) => (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
      <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={onRetry}>
        重新获取
      </Button>
    </Empty>
  );

  /** 出售列表内容：桌面端两列并排 + 移动端单列分页 */
  const listingsBody = () => {
    if (listingsLoading) return <Skeleton active paragraph={{ rows: 10 }} title={false} />;
    if (listingsError) return fetchError("出售列表获取失败", retryListings);
    if (!priceData?.listings?.length) return <Empty description="暂无出售数据" />;
    return (
      <>
        <div className="data-table-desktop">
          <TwoColumnGrid
            items={priceData.listings}
            fields={listingCols}
            rowKey={(l) => l.listingID ?? `${l.worldName}-${l.pricePerUnit}-${l.quantity}-${l.hq}`}
            rowClassName={(_, index) => (index < 3 ? "top-three-row" : "")}
            groupKey={(l) => l.worldName}
          />
        </div>
        <div className="data-mobile-table">
          <MobilePagedList
            key={`${selectedItem.row_id}-${scope}-listings`}
            items={priceData.listings}
            groupKey={(l) => l.worldName}
            renderItem={(item, index, hue) => (
              <div
                key={index}
                className={`data-mobile-item${index < 3 ? " top-three-row" : ""}${hue !== undefined ? " server-colored" : ""}`}
                style={hue !== undefined ? ({ "--server-hue": String(hue) } as CSSProperties) : undefined}
              >
                <div className="data-mobile-line">
                  {renderWorldName(item.worldName)}
                  {item.hq
                    ? <Tag color="gold" className="hq-tag">HQ</Tag>
                    : <Tag className="nq-tag">NQ</Tag>}
                </div>
                <div className="data-mobile-line">
                  <span className="price-cell">
                    {formatPrice(taxed ? withMarketTax(item.pricePerUnit) : item.pricePerUnit, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
                  </span>
                  <span className="data-mobile-meta">×{item.quantity} · 总计 {formatPrice(taxed ? withMarketTax(item.total) : item.total, getCurrentPriceFormat())} Gil</span>
                </div>
              </div>
            )}
          />
        </div>
      </>
    );
  };

  /** 交易历史内容：桌面端表格 + 移动端单列分页 */
  const historyBody = () => {
    if (historyLoading) return <Skeleton active paragraph={{ rows: 9 }} title={false} />;
    if (historyError) return fetchError("交易历史获取失败", retryHistory);
    if (!priceData?.recentHistory?.length) return <Empty description="暂无交易记录" />;
    return (
      <>
        <div className="data-table-desktop">
          <TwoColumnGrid
            items={priceData.recentHistory}
            fields={historyCols}
            rowKey={(h) => `${h.timestamp}-${h.worldName}-${h.pricePerUnit}-${h.quantity}-${h.hq}`}
            groupKey={(h) => h.worldName}
          />
        </div>
        <div className="data-mobile-table">
          <MobilePagedList
            key={`${selectedItem.row_id}-${scope}-history`}
            items={priceData.recentHistory}
            groupKey={(h) => h.worldName}
            renderItem={(item, _index, hue) => (
              <div
                key={item.timestamp + item.worldName + item.pricePerUnit}
                className={`data-mobile-item${hue !== undefined ? " server-colored" : ""}`}
                style={hue !== undefined ? ({ "--server-hue": String(hue) } as CSSProperties) : undefined}
              >
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
                  <span className="data-mobile-meta">
                    {item.onMannequin === true && renderMannequinTag()}
                    {item.buyerName}
                  </span>
                  <span className="time-cell">{formatTradeTime(item.timestamp)}</span>
                </div>
              </div>
            )}
          />
        </div>
      </>
    );
  };

  const dataCard = () => (
    <Card
      title={
        <>
          {showHistory ? <HistoryOutlined /> : <ShoppingCartOutlined />}{" "}
          {showHistory ? "交易历史" : "出售列表"}
          {!showHistory && filteredMannequinCount > 0 && (
            <Typography.Text
              type="secondary"
              className="data-card-filter-note"
            >
              已过滤 {filteredMannequinCount} 条服装模特交易数据
            </Typography.Text>
          )}
        </>
      }
      size="small"
      className="data-card"
      extra={
        <Space size={4}>
          {!showHistory && (
            <Button
              type={taxed ? "primary" : "text"}
              size="small"
              className="data-card-tax"
              icon={<CalculatorOutlined />}
              title={taxed ? "当前显示税后价，点击恢复税前价" : "显示税后价（5%）"}
              onClick={() => setTaxed((v) => { const next = !v; storage.marketTax.save(next); return next; })}
            >
              
            </Button>
          )}
          <Button
            type="text"
            size="small"
            className="data-card-toggle"
            icon={<SwapOutlined />}
            title={showHistory ? "切换回出售列表" : "切换到交易历史"}
            onClick={handleToggleHistory}
          >
          </Button>
        </Space>
      }
    >
      {showHistory ? historyBody() : listingsBody()}
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

        {/* 大区/服务器选择：与物品名/标签同行，靠右，节省高度 */}
        <RegionSelector
          hqOnly={hqOnly}
          canBeHq={canBeHq}
          onHqOnlyChange={handleHqOnlyToggle}
        />
      </div>

      {/* 模块一：查价结果（出售列表 / 交易历史，标题栏按钮切换） */}
      <section className="price-module">
        {dataCard()}
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
            listings={priceData?.listings ?? []}
            hqOnly={hqOnly}
          />
        </Suspense>
      </section>
    </div>
  );
}
