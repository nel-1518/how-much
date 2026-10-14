import { useMemo, useState, useEffect, useRef } from "react";
import { Button, Input, Empty, Spin, Alert, Tag, Select, Table, Popconfirm, message } from "antd";
import type { TableProps } from "antd";
import {
  SearchOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  UnorderedListOutlined,
  SaveOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import type {
  BatchItem,
  ItemDbEntry,
  AggregatedItemResult,
  AggregatedScopeData,
  AggregatedScopeValue,
} from "../types";
import { RegionSelector } from "./RegionSelector";
import { renderWorldName, formatRelativeTime } from "../columns";
import type { BatchPriceQuery } from "../hooks/useBatchPriceQuery";
import type { SavedBatchSet } from "../storage";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
import { DC_NAMES, isWorldName, WORLD_ID_TO_NAME } from "../constants";
import { useRegionScopeContext } from "../contexts/RegionScopeContext";

interface BatchItemDb {
  status: "loading" | "ready" | "error";
  ready: boolean;
  /** 精确名称匹配（忽略大小写与 FF14 特殊字符），命中返回对应条目 */
  findExactName: (query: string) => ItemDbEntry | undefined;
}

interface BatchPriceSectionProps {
  itemDb: BatchItemDb;
  /** 批量查价状态（由页面持有，与侧栏共享） */
  batch: BatchPriceQuery;
  /** 已保存物品集（由页面持有） */
  sets: SavedBatchSet[];
  /** 当前已载入的物品集 id */
  loadedSetId?: string;
  /** 物品集名称输入值 */
  setName: string;
  onSetNameChange: (value: string) => void;
  /** 保存当前物品集 */
  onSaveSet: () => void;
  /** 载入物品集（传 undefined 表示清除选择） */
  onLoadSet: (id?: string) => void;
  /** 删除指定物品集 */
  onRemoveSet: (id: string) => void;
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

interface ItemPrices {
  minPrice: number | null;
  minQuality: "nq" | "hq" | null;
  minWorldId?: number;
  avgPrice: number | null;
  lastUpload?: number;
}

/** 计算单个物品在指定范围/品质开关下的行情摘要（供表格行内展示） */
function computePrices(
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

  // 成交均价取当前展示品质（最低价对应的 NQ/HQ）的价格，而非默认 HQ
  const nqAvg = pickLevel(nq?.averageSalePrice, level)?.price;
  const hqAvg = pickLevel(hq?.averageSalePrice, level)?.price;
  const avgPrice = minQuality === "hq"
    ? (hqAvg ?? null)
    : minQuality === "nq"
      ? (nqAvg ?? null)
      : (nqAvg ?? hqAvg ?? null);

  const lastUpload = result?.worldUploadTimes?.reduce((mx, t) => Math.max(mx, t.timestamp), 0);
  return { minPrice, minQuality, minWorldId, avgPrice, lastUpload };
}

/** 批量查价主视图：区服选择栏（顶部）+ 左批量输入 / 右已选（行内价格） */
export function BatchPriceSection({
  itemDb,
  batch,
  sets,
  loadedSetId,
  setName,
  onSetNameChange,
  onSaveSet,
  onLoadSet,
  onRemoveSet,
  onOpenSingleItem,
}: BatchPriceSectionProps) {
  const { scope } = useRegionScopeContext();
  // clearResults 为稳定引用（useCallback），抽出以供范围切换副作用安全依赖
  const { clearResults } = batch;

  // 批量查价失败由具体 UI 决定提示方式（hook 只返回 error 状态）
  useEffect(() => {
    if (batch.error) message.error(batch.error);
  }, [batch.error]);
  const [hqOnly, setHqOnly] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

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
    clearResults();
    if (itemsRef.current.length > 0) {
      queryRef.current(scope);
    }
  }, [scope, clearResults]);

  // ---- 批量输入解析与匹配 ----
  // 每行一个物品名：后台对物品名做精确匹配，命中打勾、未命中打叉；命中项自动加入右侧已选
  const { findExactName } = itemDb;
  const parsedLines = useMemo(() => {
    const seen = new Set<string>();
    const rows: { key: string; raw: string; entry: ItemDbEntry | null }[] = [];
    for (const line of bulkInput.split(/\r?\n/)) {
      const raw = line.trim();
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      rows.push({ key: raw, raw, entry: dbReady ? (findExactName(raw) ?? null) : null });
    }
    return rows;
  }, [bulkInput, dbReady, findExactName]);

  const matchedCount = parsedLines.reduce((n, r) => n + (r.entry ? 1 : 0), 0);

  // 左侧行号栏：与输入框每一行严格对齐（wrap=off，故一逻辑行=一显示行）
  // ok=命中打勾 / fail=未命中打叉 / empty=空行或数据库未就绪（占位保持对齐）
  type LineMark = "ok" | "fail" | "empty";
  const lineMarks = useMemo<LineMark[]>(
    () =>
      bulkInput.split(/\r?\n/).map((line) => {
        const raw = line.trim();
        if (!raw || !dbReady) return "empty";
        return findExactName(raw) ? "ok" : "fail";
      }),
    [bulkInput, dbReady, findExactName],
  );

  // 输入框滚动时同步左侧标识栏，保证打勾/打叉始终贴合对应行
  const gutterRef = useRef<HTMLDivElement>(null);
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  // 查价结果表格滚动容器（表头吸附其顶部，不随内容滚出）
  const tableWrapRef = useRef<HTMLDivElement>(null);

  // 命中的物品自动加入右侧已选（addByEntry 内部去重并遵守上限）
  const addByEntry = batch.addByEntry;
  useEffect(() => {
    if (!dbReady) return;
    for (const row of parsedLines) {
      if (row.entry) {
        addByEntry({ id: row.entry.id, name: row.entry.name, canBeHq: row.entry.hq === 1 });
      }
    }
  }, [parsedLines, dbReady, addByEntry]);

  // ---- 结果映射 ----
  const resultMap = useMemo(() => {
    const m = new Map<number, AggregatedItemResult>();
    for (const r of batch.results?.results ?? []) m.set(r.itemId, r);
    return m;
  }, [batch.results]);

  const failedItems = batch.results?.failedItems ?? [];

  /** 复制物品名到剪贴板（点击物品名时触发） */
  const handleCopyName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      message.success("已复制物品名：" + name);
    } catch {
      message.error("复制失败");
    }
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
            onClick={() => handleCopyName(item.name)}
            title="点击复制物品名"
          >
            {item.name}
          </button>
        </div>
      ),
    },
    {
      title: "最低价",
      key: "minPrice",
      width: 130,
      align: "right",
      render: (_, item) => {
        const p = computePrices(resultMap.get(item.id), level, hqOnly);
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
        const p = computePrices(resultMap.get(item.id), level, hqOnly);
        if (p.minPrice == null || !p.minQuality) return <span className="batch-result-na">—</span>;
        return (
          <Tag className={p.minQuality === "hq" ? "hq-tag" : "nq-tag"}>{p.minQuality.toUpperCase()}</Tag>
        );
      },
    },
    {
      title: "服务器",
      key: "server",
      width: 100,
      render: (_, item) => {
        const p = computePrices(resultMap.get(item.id), level, hqOnly);
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
        const p = computePrices(resultMap.get(item.id), level, hqOnly);
        return p.avgPrice != null
          ? <span className="batch-cell-price">{fmtAvg(p.avgPrice)}</span>
          : <span className="batch-result-na">—</span>;
      },
    },
    {
      title: "更新时间",
      key: "updated",
      width: 80,
      align: "right",
      // 移动端不显示更新时间
      responsive: ["md"],
      render: (_, item) => {
        const p = computePrices(resultMap.get(item.id), level, hqOnly);
        return <span className="time-cell">{formatRelativeTime(p.lastUpload ?? 0)}</span>;
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 88,
      align: "center",
      render: (_, item) => (
        <div className="batch-row-actions">
          <Button
            type="text"
            size="small"
            icon={<ExportOutlined />}
            aria-label={"查看 " + item.name + " 的查价详情"}
            title="查看单个查价详情"
            onClick={() => onOpenSingleItem(item)}
          />
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            aria-label={"移除 " + item.name}
            onClick={() => batch.removeItem(item.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="price-area batch-area">
      <RegionSelector
        hqOnly={hqOnly}
        canBeHq={true}
        onHqOnlyChange={setHqOnly}
      />

      <div className="batch-layout">
        {/* 左：批量输入物品 */}
        <section className="batch-card batch-col-left">
          <div className="batch-card-title">
            <SearchOutlined /> 输入物品（{matchedCount}/{parsedLines.length} 已匹配）
          </div>
          <div className={"batch-editor" + (dbReady ? "" : " disabled")}>
            <div className="batch-editor-gutter" ref={gutterRef} aria-hidden="true">
              {lineMarks.map((mark, i) => (
                <div key={i} className={"batch-editor-mark " + mark}>
                  {mark === "ok" ? <CheckOutlined /> : mark === "fail" ? <CloseOutlined /> : null}
                </div>
              ))}
            </div>
            <Input.TextArea
              className="batch-editor-input"
              wrap="off"
              placeholder={
                dbReady
                  ? "每行输入一个物品名称，自动匹配…"
                  : itemDb.status === "loading"
                    ? "物品数据库加载中…"
                    : "物品数据库加载失败"
              }
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              onScroll={handleEditorScroll}
              autoFocus
            />
          </div>
        </section>

        {/* 右：已选物品 + 行内价格 */}
        <section className="batch-card batch-col-right">
          <div className="batch-card-head">
            <span className="batch-card-title"><UnorderedListOutlined /> 已选物品（{batch.items.length}）</span>
          </div>

          <div className="batch-save-row">
            <div className="batch-save-left">
              <Input
                className="batch-set-name"
                placeholder="物品集名称"
                value={setName}
                onChange={(e) => onSetNameChange(e.target.value)}
                onPressEnter={onSaveSet}
                maxLength={20}
                allowClear
              />
              <Button size="small" icon={<SaveOutlined />} onClick={onSaveSet}>
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
                onChange={onLoadSet}
              />
              <Popconfirm title="确定删除该物品集？" okText="删除" cancelText="取消" onConfirm={() => loadedSetId && onRemoveSet(loadedSetId)} disabled={!loadedSetId}>
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

          <div className="batch-table-wrap" ref={tableWrapRef}>
            {batch.loading ? (
              <div className="batch-results-loading"><Spin /></div>
            ) : batch.items.length === 0 ? (
              <Empty description="在左侧输入物品名称，匹配成功后自动加入" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={batch.items}
                pagination={false}
                sticky={{ getContainer: () => tableWrapRef.current ?? window }}
                scroll={{ x: 785 }}
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

          <div className="batch-actions">
            <Button
              type="primary"
              className="batch-query-btn"
              disabled={batch.items.length === 0}
              loading={batch.loading}
              onClick={() => batch.query(scope)}
            >
              开始查价（{batch.items.length}）
            </Button>
            <Popconfirm
              title="确定清空已选物品？"
              description="已选物品与查价结果都会被移除。"
              okText="清空"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={batch.clear}
              disabled={batch.items.length === 0}
            >
              <Button danger disabled={batch.items.length === 0}>清空</Button>
            </Popconfirm>
          </div>
        </section>
      </div>
    </div>
  );
}
