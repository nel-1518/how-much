import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Typography, Skeleton, Card, Empty, Tag, Button, message, Pagination } from "antd";
import { ShoppingCartOutlined, HistoryOutlined, CopyOutlined, LinkOutlined, SwapOutlined } from "@ant-design/icons";
import type { ItemResult, UniversalisResponse } from "../types";
import { listingFields, historyFields, buildServerHueMap, renderWorldName, formatTradeTime, formatRelativeTime, type GridField } from "../columns";
import type { DcName } from "../constants";
import type { DcServerMap } from "../hooks/useRegionScope";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
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
  /** 交易历史懒加载：点击标题栏「交易历史」按钮时请求 */
  fetchPriceHistory: (id: number, region: string) => void;
  viewTab: string;
  onViewTabChange: (v: string) => void;
  onWiki: (name: string) => void;
  /** 当前是否为深色主题（统计图配色适配） */
  isDark: boolean;
}

/** 查价结果展示组件：大区/服务器选择栏 + 查价结果 / 价格走势与购买建议 */
export function PriceSection({
  selectedItem, scope, dcServer, onScopeChange, onSelectServer,
  priceData, listingsLoading, historyLoading, fetchPriceData, fetchPriceHistory,
  viewTab, onViewTabChange, onWiki, isDark,
}: PriceSectionProps) {
  // 只看 HQ 开关（物品存在 HQ 品质时才可用）
  const [hqOnly, setHqOnly] = useState(false);
  // 相对时间（xx分前）定时刷新：每 30 秒更新一次基准时间
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const listingCols = useMemo(() => listingFields(nowTs), [nowTs]);
  const historyCols = useMemo(() => historyFields(), []);

  const canBeHq = selectedItem.canBeHq === true;
  // 当前展示：出售列表 / 交易历史（交易历史由标题栏按钮切换并懒加载）
  const showHistory = viewTab === "history";

  /** 查询目标变化（"中国"/大区）：更新全局状态并重新查价；若正在看历史则同步刷新历史 */
  const handleScopeChange = (next: string) => {
    onScopeChange(next);
    fetchPriceData(selectedItem.row_id, next, selectedItem.fields.Name, hqOnly);
    if (showHistory) fetchPriceHistory(selectedItem.row_id, next);
  };

  /** 选择某大区下的服务器：更新全局状态并重新查价；若正在看历史则同步刷新历史 */
  const handleSelectServer = (dc: DcName, world: string) => {
    onSelectServer(dc, world);
    fetchPriceData(selectedItem.row_id, world, selectedItem.fields.Name, hqOnly);
    if (showHistory) fetchPriceHistory(selectedItem.row_id, world);
  };

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

  /** 出售列表内容：桌面端两列并排 + 移动端单列分页 */
  const listingsBody = () => {
    if (listingsLoading) return <Skeleton active paragraph={{ rows: 10 }} title={false} />;
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
                    {formatPrice(item.pricePerUnit, getCurrentPriceFormat())} <span className="gil-suffix">Gil</span>
                  </span>
                  <span className="data-mobile-meta">×{item.quantity} · 总计 {formatPrice(item.total, getCurrentPriceFormat())} Gil</span>
                </div>
                <div className="data-mobile-line data-mobile-sub">
                  <span className="data-mobile-meta">更新时间 {formatRelativeTime(item.lastReviewTime ?? 0, nowTs)}</span>
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
                  <span className="data-mobile-meta">{item.buyerName}</span>
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
      title={<>{showHistory ? <HistoryOutlined /> : <ShoppingCartOutlined />} {showHistory ? "交易历史" : "出售列表"}</>}
      size="small"
      className="data-card"
      extra={
        <Button
          type="text"
          size="small"
          className="data-card-toggle"
          icon={<SwapOutlined />}
          onClick={handleToggleHistory}
          title={showHistory ? "切换回出售列表" : "切换到交易历史"}
        >
        </Button>
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
          scope={scope}
          dcServer={dcServer}
          hqOnly={hqOnly}
          canBeHq={canBeHq}
          onScopeChange={handleScopeChange}
          onSelectServer={handleSelectServer}
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
            isDark={isDark}
            listings={priceData?.listings ?? []}
            hqOnly={hqOnly}
          />
        </Suspense>
      </section>
    </div>
  );
}
