import { useMemo, useState, useEffect, useRef } from "react";
import { Button, Input, Empty, Spin, Alert, Tag, Select, Table, Popconfirm, message } from "antd";
import type { TableProps } from "antd";
import {
  SearchOutlined,
  DeleteOutlined,
  CheckOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type {
  BatchItem,
  ItemDbEntry,
  AggregatedItemResult,
  AggregatedScopeData,
  AggregatedScopeValue,
} from "../types";
import { RegionSelector } from "./RegionSelector";
import { renderWorldName } from "../columns";
import { useBatchPriceQuery } from "../hooks/useBatchPriceQuery";
import { useSavedItemSets } from "../hooks/useSavedItemSets";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
import { DC_NAMES, isWorldName, WORLD_ID_TO_NAME, type DcName } from "../constants";
import type { DcServerMap } from "../hooks/useRegionScope";

interface BatchItemDb {
  status: "loading" | "ready" | "error";
  ready: boolean;
  searchByName: (query: string, limit?: number) => ItemDbEntry[];
}

interface BatchPriceSectionProps {
  scope: string;
  dcServer: DcServerMap;
  onScopeChange: (scope: string) => void;
  onSelectServer: (dc: DcName, world: string) => void;
  itemDb: BatchItemDb;
  onOpenSingleItem: (item: BatchItem) => void;
}

type ScopeLevel = "world" | "dc" | "region";

/** 由查询范围决定取聚合结果哪一层的值（服务器→world，大区→dc，中国→region） */
function scopeLevel(scope: string): ScopeLevel {
  if (isWorldName(scope)) return "world";
  if ((DC_NAMES as readonly string[]).includes(scope)) return "dc";
  return "region";
}

/** 取指定范围的聚合值（该范围无数据则返回 null，不做跨范围回退） */
function pickLevel(
  data: AggregatedScopeData | null | undefined,
  level: ScopeLevel,
): AggregatedScopeValue | null {
  if (!data) return null;
  const v = data[level];
  if (!v) return null;
  if (v.price != null || v.quantity != null || v.timestamp != null) return v;
  return null;
}

/** 时间戳（秒或毫秒自动识别）-> 相对时间文案 */
function formatRelativeTime(ts?: number): string {
  if (!ts) return "—";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return min + " 分钟前";
  const h = Math.floor(min / 60);
  if (h < 24) return h + " 小时前";
  return Math.floor(h / 24) + " 天前";
}

interface ItemPrices {
  minPrice: number | null;
  minQuality: "nq" | "hq" | null;
  minWorldId?: number;
  avgPrice: number | null;
  velocity: number | null;
  lastUpload?: number;
}

/** 计算单个物品在指定范围/品质开关下的行情摘要（供表格行内展示） */
function computePrices(
  item: BatchItem,
  result: AggregatedItemResult | undefined,
  level: ScopeLevel,
  hqOnly: boolean,
): ItemPrices {
  const nq = result?.nq;
  const hq = result?.hq;
  const nqMin = pickLevel(nq?.minListing, level);
  const hqMin = pickLevel(hq?.minListing, level);

  let minPrice: number | null = null;
  let minQuality: "nq" | "hq" | null = null;
  let minWorldId: number | undefined;
  if (hqOnly) {
    if (hqMin?.price != null) { minPrice = hqMin.price; minQuality = "hq"; minWorldId = hqMin.worldId; }
  } else {
    const nqP = nqMin?.price;
    const hqP = hqMin?.price;
    if (nqP != null && hqP != null) {
      if (nqP <= hqP) { minPrice = nqP; minQuality = "nq"; minWorldId = nqMin?.worldId; }
      else { minPrice = hqP; minQuality = "hq"; minWorldId = hqMin?.worldId; }
    } else if (nqP != null) {
      minPrice = nqP; minQuality = "nq"; minWorldId = nqMin?.worldId;
    } else if (hqP != null) {
      minPrice = hqP; minQuality = "hq"; minWorldId = hqMin?.worldId;
    }
  }

  const nqAvg = pickLevel(nq?.averageSalePrice, level)?.price;
  const hqAvg = pickLevel(hq?.averageSalePrice, level)?.price;
  const avgPrice = hqOnly
    ? (hqAvg != null ? hqAvg : null)
    : item.canBeHq
      ? (hqAvg != null ? hqAvg : (nqAvg != null ? nqAvg : null))
      : (nqAvg != null ? nqAvg : (hqAvg != null ? hqAvg : null));

  const nqVel = pickLevel(nq?.dailySaleVelocity, level)?.quantity;
  const hqVel = pickLevel(hq?.dailySaleVelocity, level)?.quantity;
  const velocity = hqOnly
    ? (hqVel != null ? hqVel : null)
    : item.canBeHq
      ? (hqVel != null ? hqVel : (nqVel != null ? nqVel : null))
      : (nqVel != null ? nqVel : (hqVel != null ? hqVel : null));

  const lastUpload = result?.worldUploadTimes?.reduce((mx, t) => Math.max(mx, t.timestamp), 0);
  return { minPrice, minQuality, minWorldId, avgPrice, velocity, lastUpload };
}

/** 批量查价主视图：区服选择栏（顶部）+ 左搜索 / 右已选（行内价格） */
export function BatchPriceSection({
  scope, dcServer, onScopeChange, onSelectServer, itemDb, onOpenSingleItem,
}: BatchPriceSectionProps) {
  const batch = useBatchPriceQuery();
  const { sets, saveSet, removeSet } = useSavedItemSets();
  const [hqOnly, setHqOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ItemDbEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [setName, setSetName] = useState("");
  const [loadedSetId, setLoadedSetId] = useState<string | undefined>(undefined);

  const dbReady = itemDb.status === "ready";
  const level = scopeLevel(scope);
  const fmt = (v: number) => formatPrice(v, getCurrentPriceFormat());
  const fmtAvg = (v: number) => (Number.isInteger(v) ? fmt(v) : v.toFixed(1));

  // 切换查询范围（大区/服务器/中国）时：清空旧结果，若有已选物品则按新范围自动查价
  const prevScopeRef = useRef(scope);
  const itemsRef = useRef(batch.items);
  useEffect(() => { itemsRef.current = batch.items; }, [batch.items]);
  const queryRef = useRef(batch.query);
  useEffect(() => { queryRef.current = batch.query; }, [batch.query]);
  useEffect(() => {
    if (prevScopeRef.current === scope) return;
    prevScopeRef.current = scope;
    batch.clearResults();
    if (itemsRef.current.length > 0) {
      queryRef.current(scope);
    }
  }, [scope, batch.clearResults]);

  // ---- 搜索 ----
  const handleSearchChange = (v: string) => {
    setQuery(v);
    setActiveIndex(0);
    const t = v.trim();
    if (!t || !dbReady) { setSearchResults([]); return; }
    setSearchResults(itemDb.searchByName(t, 20));
  };

  const addEntry = (entry: ItemDbEntry) => {
    batch.addByEntry({ id: entry.id, name: entry.name, canBeHq: entry.hq === 1 });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (searchResults.length > 0) {
        e.preventDefault();
        setActiveIndex((p) => Math.min(p + 1, searchResults.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      if (searchResults.length > 0) {
        e.preventDefault();
        setActiveIndex((p) => Math.max(p - 1, 0));
      }
    } else if (e.key === "Enter") {
      if (searchResults.length > 0) {
        e.preventDefault();
        addEntry(searchResults[activeIndex]);
      }
    }
  };

  // ---- 结果映射 ----
  const resultMap = useMemo(() => {
    const m = new Map<number, AggregatedItemResult>();
    for (const r of batch.results?.results ?? []) m.set(r.itemId, r);
    return m;
  }, [batch.results]);

  const failedItems = batch.results?.failedItems ?? [];

  // ---- 物品集保存 / 载入 / 删除 ----
  const handleSave = () => { saveSet(setName, batch.items); };
  const handleLoad = (id?: string) => {
    setLoadedSetId(id);
    if (!id) return;
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    batch.clear();
    setSetName(set.name);
    for (const it of set.items) batch.addByEntry(it);
    message.success("已载入物品集「" + set.name + "」");
  };
  const handleDeleteSet = () => {
    if (!loadedSetId) return;
    const set = sets.find((s) => s.id === loadedSetId);
    removeSet(loadedSetId);
    setLoadedSetId(undefined);
    if (set) message.success("已删除物品集「" + set.name + "」");
  };

  // ---- 已选物品表格列 ----
  const columns: TableProps<BatchItem>["columns"] = [
    {
      title: "物品",
      key: "name",
      width: 180,
      render: (_, item) => (
        <div className="batch-cell-name">
          <button
            type="button"
            className="batch-result-name"
            onClick={() => onOpenSingleItem(item)}
            title="查看单个查价详情"
          >
            {item.name}
          </button>
          {item.canBeHq && <Tag color="gold" className="hq-tag">HQ</Tag>}
        </div>
      ),
    },
    {
      title: "最低价",
      key: "minPrice",
      width: 130,
      align: "right",
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        if (p.minPrice == null) return <span className="batch-result-na">—</span>;
        return <span className="batch-cell-price">{fmt(p.minPrice)}</span>;
      },
    },
    {
      title: "品质",
      key: "quality",
      width: 64,
      align: "center",
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        if (p.minPrice == null || !p.minQuality) return <span className="batch-result-na">—</span>;
        return (
          <Tag className={p.minQuality === "hq" ? "hq-tag" : "nq-tag"}>{p.minQuality.toUpperCase()}</Tag>
        );
      },
    },
    {
      title: "服务器",
      key: "server",
      width: 120,
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        if (p.minPrice == null) return <span className="batch-result-na">—</span>;
        const serverName = level === "world"
          ? scope
          : p.minWorldId != null ? WORLD_ID_TO_NAME[p.minWorldId] : undefined;
        return serverName
          ? renderWorldName(serverName)
          : <span className="batch-result-na">—</span>;
      },
    },
    {
      title: "成交均价",
      key: "avgPrice",
      width: 130,
      align: "right",
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        return p.avgPrice != null
          ? <span className="batch-cell-price">{fmtAvg(p.avgPrice)}</span>
          : <span className="batch-result-na">—</span>;
      },
    },
    {
      title: "日销",
      key: "velocity",
      width: 80,
      align: "center",
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        return p.velocity != null
          ? p.velocity.toFixed(1)
          : <span className="batch-result-na">—</span>;
      },
    },
    {
      title: "更新时间",
      key: "updated",
      width: 110,
      render: (_, item) => {
        const p = computePrices(item, resultMap.get(item.id), level, hqOnly);
        return <span className="time-cell">{formatRelativeTime(p.lastUpload)}</span>;
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 56,
      align: "center",
      render: (_, item) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          aria-label={"移除 " + item.name}
          onClick={() => batch.removeItem(item.id)}
        />
      ),
    },
  ];

  return (
    <div className="price-area batch-area">
      <RegionSelector
        scope={scope}
        dcServer={dcServer}
        hqOnly={hqOnly}
        canBeHq={true}
        onScopeChange={onScopeChange}
        onSelectServer={onSelectServer}
        onHqOnlyChange={setHqOnly}
      />

      <div className="batch-layout">
        {/* 左：搜索物品 */}
        <section className="batch-card batch-col-left">
          <div className="batch-card-title"><SearchOutlined /> 搜索物品</div>
          <Input
            className="batch-search-input"
            placeholder={dbReady ? "输入物品名称，点击结果加入右侧" : itemDb.status === "loading" ? "物品数据库加载中…" : "物品数据库加载失败"}
            prefix={<SearchOutlined />}
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            allowClear
            autoFocus
          />
          <div className="batch-search-results">
            {!dbReady ? (
              <Empty description={itemDb.status === "loading" ? "物品数据库加载中…" : "物品数据库加载失败"} />
            ) : query.trim() === "" ? (
              <Empty description="输入物品名称开始搜索" />
            ) : searchResults.length === 0 ? (
              <Empty description="未找到相关物品" />
            ) : (
              searchResults.map((entry, i) => {
                const added = batch.items.some((it) => it.id === entry.id);
                return (
                  <div
                    key={entry.id}
                    className={
                      "batch-search-item" +
                      (i === activeIndex ? " active" : "") +
                      (added ? " added" : "")
                    }
                    onClick={() => { if (!added) addEntry(entry); }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="batch-search-name">{entry.name}</span>
                    {entry.hq === 1 && <Tag color="gold" className="hq-tag">HQ</Tag>}
                    <span className="batch-search-add">
                      {added ? (<><CheckOutlined /> 已添加</>) : (<><PlusOutlined /> 添加</>)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 右：已选物品 + 行内价格 */}
        <section className="batch-card batch-col-right">
          <div className="batch-card-head">
            <span className="batch-card-title"><UnorderedListOutlined /> 已选物品（{batch.items.length}）</span>
            <Button type="text" size="small" onClick={batch.clear} disabled={batch.items.length === 0}>
              清空
            </Button>
          </div>

          <div className="batch-save-row">
            <div className="batch-save-left">
              <Input
                className="batch-set-name"
                placeholder="物品集名称"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                onPressEnter={handleSave}
                maxLength={20}
                allowClear
              />
              <Button size="small" icon={<SaveOutlined />} onClick={handleSave}>
                保存
              </Button>
            </div>
            <div className="batch-save-right">
              <Select
                className="batch-set-load"
                placeholder="载入物品集"
                allowClear
                showSearch
                optionFilterProp="label"
                value={loadedSetId}
                options={sets.map((s) => ({ value: s.id, label: s.name + "（" + s.items.length + " 件）" }))}
                onChange={handleLoad}
              />
              <Popconfirm title="确定删除该物品集？" okText="删除" cancelText="取消" onConfirm={handleDeleteSet} disabled={!loadedSetId}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label="删除物品集"
                  disabled={!loadedSetId}
                />
              </Popconfirm>
            </div>
          </div>

          <div className="batch-table-wrap">
            {batch.loading ? (
              <div className="batch-results-loading"><Spin /></div>
            ) : batch.items.length === 0 ? (
              <Empty description="点击左侧搜索结果添加物品" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={batch.items}
                pagination={false}
                scroll={{ x: 880 }}
              />
            )}
          </div>

          {!batch.loading && batch.results && failedItems.length > 0 && (
            <Alert
              className="batch-failed-alert"
              type="warning"
              showIcon
              message={failedItems.length + " 个物品查询失败"}
              description={"失败物品 ID：" + failedItems.join("、")}
            />
          )}

          <Button
            type="primary"
            className="batch-query-btn"
            disabled={batch.items.length === 0}
            loading={batch.loading}
            onClick={() => batch.query(scope)}
          >
            开始查价（{batch.items.length}）
          </Button>
        </section>
      </div>
    </div>
  );
}
