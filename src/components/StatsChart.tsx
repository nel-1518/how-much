import { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import type { Plugin } from "chart.js";
import { Card, Divider, Empty, Segmented, Spin } from "antd";
import { LineChartOutlined, ThunderboltOutlined, InfoCircleOutlined } from "@ant-design/icons";
import {
  fetchDailyStats,
  pickSeries,
  pickAdvice,
  serverRangeOf,
  STATS_RANGE_OPTIONS,
  type DailyStatsResponse,
  type StatsDay,
} from "../utils/statsApi";
import { useCachedFetch } from "../hooks/useCachedFetch";
import { useTheme } from "../contexts/ThemeContext";
import { formatPrice, getCurrentPriceFormat } from "../utils/formatPrice";
import { analyzePurchaseAdvice } from "../utils/purchaseAdvice";
import { PurchaseAdvice } from "./PurchaseAdvice";
import type { UniversalisListing } from "../types";

/** 时间范围选项：7天 / 14天 / 30天 / 半年 / 一年（7、14 天由 30 天数据裁剪） */
const RANGE_OPTIONS = STATS_RANGE_OPTIONS.map((o) => ({ label: o.label, value: o.value }));

type QualityKey = "nq" | "hq" | "all";

/**
 * x 轴日期刻度格式：跨年时 yyyy/mm/dd，不跨年时 mm/dd。
 * label 为东八区 YYYY-MM-DD。
 */
function formatDateTick(label: string, spanYears: boolean): string {
  const [y, m, d] = label.split("-");
  if (!y || !m || !d) return label;
  return spanYears ? `${y}/${m}/${d}` : `${m}/${d}`;
}

/** 东八区 YYYY-MM-DD 递增 1 天 */
function addDay(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/**
 * 线性拟合（最小二乘法）：对一组 (x, y) 点求回归直线 y = a + b·x。
 * 返回斜率 b 与截距 a；不足 2 个点或 x 无方差时返回 null（无法拟合）。
 */
function linearFit(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) {
    sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

/**
 * 平均价趋势线：对填充序列中非空日期的 avgPrice 做线性回归，得到一条贯穿整个
 * 时间范围的直线（每日预测值），用于直观展示价格升降趋势。
 * 返回与 days 等长的数组（首尾两点有值，其余 null 由 spanGaps 连线成直线）；
 * 数据不足时返回 null。
 */
function fitAvgPriceTrend(days: (StatsDay | null)[]): (number | null)[] | null {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (d && Number.isFinite(d.avgPrice) && d.avgPrice > 0) {
      pts.push({ x: i, y: d.avgPrice });
    }
  }
  const fit = linearFit(pts);
  if (!fit) return null;
  // 只填首尾两点（按回归线预测值），中间 null 由 spanGaps 连线成一条直线
  return days.map((_, i) => (i === 0 || i === days.length - 1) ? fit.intercept + fit.slope * i : null);
}

/**
 * 按天补全序列：从首日到末日每日占一个单元，无数据日期用 null 填充（Chart.js
 * spanGaps 会跳过 null 并连线到下一个有数据的日期），保证时间轴平均分布。
 * 返回 { labels, days }：labels 为完整日期序列，days 中无数据项为 null。
 */
function fillDailySeries(days: StatsDay[]): { labels: string[]; days: (StatsDay | null)[] } {
  if (days.length === 0) return { labels: [], days: [] };
  const byDate = new Map(days.map((d) => [d.date, d]));
  const labels: string[] = [];
  const filled: (StatsDay | null)[] = [];
  let cur = days[0].date;
  const end = days[days.length - 1].date;
  // 防御：循环上限 400 天，避免异常数据导致死循环
  for (let i = 0; i < 400 && cur <= end; i++) {
    labels.push(cur);
    filled.push(byDate.get(cur) ?? null);
    cur = addDay(cur);
  }
  return { labels, days: filled };
}

interface StatsChartProps {
  itemId: number;
  region: string;
  /** 物品是否存在 HQ 品质（hq=0 时只显示 nq） */
  canBeHq: boolean;
  /** 前端查价结果的挂单列表（购买建议用当前挂单价对比；查价未返回时为空） */
  listings: UniversalisListing[];
  /** 只看 HQ（购买建议挂单只看 HQ） */
  hqOnly: boolean;
}

// 图表配色统一由 ThemeContext 提供（见 useTheme().chart）
// 当前图表时间轴是否跨年（决定 x 轴刻度用 yyyy/mm/dd 还是 mm/dd；每次更新前刷新）
let xLabelSpanYears = false;
// 从左到右渐显动画进度（0~1）：仅数据变化触发的渐显动画更新，revealPlugin 按进度裁剪数据线区域
let revealProgress = 1;
// 是否有一次渐显动画在途（数据变化时置 true，完成后置 false）
// 用于区分“数据变化动画”与 hover 等触发的 active 动画，避免 hover 反复重播渐显
let revealPending = false;

/**
 * 自定义插件：数据线从左到右逐渐出现。
 * beforeDatasetsDraw 按当前动画进度裁剪图表区域左侧，afterDatasetsDraw 恢复，
 * 使坐标轴/网格保持完整，只有折线（数据）随进度从左到右展开。
 */
const revealPlugin: Plugin = {
  id: "revealLeftToRight",
  beforeDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const area = chart.chartArea;
    if (!area || revealProgress >= 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, (area.right - area.left) * revealProgress, area.bottom - area.top);
    ctx.clip();
  },
  afterDatasetsDraw(chart) {
    if (revealProgress >= 1) return;
    chart.ctx.restore();
  },
};

/**
 * 价格走势 + 购买建议合并模块：最高/最低价区间带 + 平均价主线 + 趋势线，
 * 数据来自 /api/stats/daily（服务端收到请求时自动注册并采集）。
 * - 时间范围：7天 / 14天 / 30天 / 半年 / 一年（默认30天；7、14 天由 30 天数据裁剪）
 * - 品质：hq=0 固定 nq；hq=1 默认 hq，可切换 nq/hq/all（切换不重新请求）
 * - 缓存：按 item+region+服务端 range 分别缓存完整响应（含对应 range 的 advice）；
 *   切换 range 时命中缓存直接使用，不重复请求（每个服务端 range 首次请求一次）
 * - 购买建议：历史统计来自服务端 advice（当前品质/range），当前挂单来自前端查价 listings，动态更新
 */
export function StatsChart({ itemId, region, canBeHq, listings, hqOnly }: StatsChartProps) {
  const { chart: palette } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [quality, setQuality] = useState<QualityKey>(canBeHq ? "hq" : "nq");
  // 统计数据：按 item+region+服务端 range 缓存完整响应；缓存 / 竞态 / 取消由 useCachedFetch 处理
  const {
    data: resp,
    loading,
    error,
    setData: setResp,
    run: runStats,
    cancel: cancelStats,
  } = useCachedFetch<DailyStatsResponse>({ initialLoading: true });

  // 品质默认值跟随物品的 canBeHq（hq=0 → 固定 nq）：
  // 在渲染期间检测 props 变化并调整 state（React 官方模式，避免在 effect 中 setState）
  const [prevCanBeHq, setPrevCanBeHq] = useState(canBeHq);
  if (canBeHq !== prevCanBeHq) {
    setPrevCanBeHq(canBeHq);
    setQuality(canBeHq ? "hq" : "nq");
  }

  // 数据获取：按 item+region+服务端range 分别缓存完整响应（含对应 range 的 advice）。
  // 切换 range 时命中缓存直接使用（每个服务端 range 首次请求一次），不再请求。
  // 注册由服务端 /api/stats/daily 收到请求时自动执行（首次注册并采集）。
  // 失败时清空数据（与原先一致）；错误文案由 useCachedFetch 返回后内联展示。
  useEffect(() => {
    // 7 / 14 天复用 30 天数据（30 天已包含），实际只请求 30 / 180 / 365
    const serverRange = serverRangeOf(rangeDays);
    const cacheKey = `${itemId}-${region}-${serverRange}`;
    void runStats(cacheKey, (signal) => fetchDailyStats(itemId, region, serverRange, signal)).then(
      (result) => {
        if (result.status === "error") setResp(null);
      },
    );
    return cancelStats;
  }, [itemId, region, rangeDays, runStats, setResp, cancelStats]);

  // 当前展示的数据：品质切换在响应内完成，无需重新请求；按天补全缺失日期使时间轴平均分布
  const filledFull = useMemo(() => fillDailySeries(pickSeries(resp, quality)), [resp, quality]);
  // 7 / 14 天直接裁剪 30 天数据（默认 30 天已包含 7、14 天），无需额外请求
  const filled = useMemo(() => {
    if (rangeDays >= 30 || filledFull.labels.length <= rangeDays) return filledFull;
    return {
      labels: filledFull.labels.slice(-rangeDays),
      days: filledFull.days.slice(-rangeDays),
    };
  }, [filledFull, rangeDays]);
  const days = filled.days;
  const hasData = resp !== null && filled.labels.length > 0 && days.some((d) => d !== null);

  // 平均价趋势线（线性回归拟合）：随时间范围/品质变化自动重算
  const trendData = useMemo(() => fitAvgPriceTrend(days), [days]);

  // 购买建议：历史统计来自服务端 advice（当前品质，随 range/区服变化），
  // 当前挂单来自前端查价 listings（动态更新，两者无先后依赖，任一方变化即重算）
  const adviceStats = useMemo(() => pickAdvice(resp, quality), [resp, quality]);
  const purchaseAdvice = useMemo(
    () => analyzePurchaseAdvice(adviceStats, listings, hqOnly),
    [adviceStats, listings, hqOnly],
  );
  // 首次注册且暂无数据时提示"数据采集中"
  const showCollectingHint = resp?.firstRegistration === true && adviceStats?.recordCount === 0;

  // 记录上一次填充数据引用：仅数据变化时触发从左到右渐显（主题切换不重放动画）
  const prevFilledRef = useRef(filled);

  // 图表实例：创建 + 数据更新 + 销毁
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    // loading 切换会把 canvas 卸载再重挂（全新 DOM 节点），旧 chart 仍绑定在已卸载的 canvas 上，
    // 此时必须销毁重建，否则新 canvas 始终空白（数据画在了已脱离 DOM 的旧 canvas 上）
    const existing = chartRef.current;
    if (existing && existing.canvas !== canvas) {
      existing.destroy();
      chartRef.current = null;
    }
    const priceColor = palette.price;
    const rangeColor = palette.range;
    const rangeFill = palette.rangeFill;
    const gridColor = palette.grid;
    const textColor = palette.text;
    // x 轴日期格式：时间范围跨年则用 yyyy/mm/dd，否则 mm/dd
    xLabelSpanYears = new Set(filled.labels.map((l) => l.slice(0, 4))).size > 1;

    if (!chartRef.current) {
      chartRef.current = new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        plugins: [revealPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          // 动画：数据线从左到右逐渐出现。onProgress 仅在 revealPending（数据变化）时更新裁剪进度，
          // hover 等触发的 active 动画不会改变 revealProgress，避免反复重播渐显
          animation: {
            duration: 800,
            easing: "easeOutQuart",
            delay: () => 0,
            onProgress: (event) => {
              if (revealPending && event.numSteps > 0) {
                revealProgress = event.currentStep / event.numSteps;
              }
            },
            onComplete: () => {
              if (revealPending) {
                revealProgress = 1;
                revealPending = false;
              }
            },
          },
          // 关闭 x 横向位移动画（渐显由裁剪实现），仅保留纵向数值过渡
          animations: {
            x: false,
            y: { duration: 800, easing: "easeOutQuart" },
            colors: false,
            radius: false,
          },
          // 图例隐藏/显示数据集：show/hide 过渡动画时长为 0（瞬时消失/出现，不做颜色淡出淡入）
          transitions: {
            show: { animation: { duration: 0 } },
            hide: { animation: { duration: 0 } },
          },
          plugins: {
            legend: {
              labels: { color: textColor, boxWidth: 12, boxHeight: 12 },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const raw = ctx.raw as number | undefined;
                  const v = typeof raw === "number" ? formatPrice(raw, getCurrentPriceFormat()) : "-";
                  return `${ctx.dataset.label}: ${v}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: textColor,
                maxTicksLimit: 8,
                callback(value) {
                  const raw = this.getLabelForValue(value as number);
                  return formatDateTick(raw, xLabelSpanYears);
                },
              },
              grid: { color: gridColor },
            },
            y: {
              position: "left",
              title: { display: false },
              ticks: {
                color: textColor,
                callback: (value) => {
                  // 轴刻度应用全局金额格式（避免过长刻度挤压图表）；
                  // 大于等于十万时改用「万」为单位，避免刻度过长
                  const num = Number(value);
                  if (!Number.isFinite(num)) return value;
                  if (Math.abs(num) >= 100000) {
                    return `${Number((num / 10000).toFixed(1))}万`;
                  }
                  return formatPrice(num, getCurrentPriceFormat());
                },
              },
              grid: { color: gridColor },
            },
          },
        },
      });
    }

    const chart = chartRef.current;
    const days = filled.days;
    // 数据引用变化 → 开启渐显动画（revealPending）并重置进度；主题切换（filled 不变）不重放
    if (prevFilledRef.current !== filled) {
      prevFilledRef.current = filled;
      revealPending = true;
      revealProgress = 0;
    }
    if (days.length === 0) {
      chart.data.labels = [];
      chart.data.datasets = [];
    } else {
      chart.data.labels = filled.labels;
      // 区间带：最高价（fill:false）+ 最低价（fill:"-1" 填充到最高价线），两线之间半透明色带
      // 平均价：更粗的突出主线，最后绘制叠加在区间带上方；无数据日期为 null，spanGaps 跳过并连线
      chart.data.datasets = [
        {
          type: "line",
          label: "最高价",
          data: days.map((d) => (d ? d.max : null)),
          borderColor: rangeColor,
          borderWidth: 1.5,
          backgroundColor: "transparent",
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
          fill: false,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "最低价",
          data: days.map((d) => (d ? d.min : null)),
          borderColor: rangeColor,
          borderWidth: 1.5,
          backgroundColor: rangeFill,
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
          fill: "-1",
          yAxisID: "y",
        },
        {
          type: "line",
          label: "平均价",
          data: days.map((d) => (d ? d.avgPrice : null)),
          borderColor: priceColor,
          borderWidth: 3,
          backgroundColor: "transparent",
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
          fill: false,
          yAxisID: "y",
        },
        // 趋势线（线性拟合）：首尾两点由 spanGaps 连线成一条直线
        ...(trendData ? [{
          type: "line" as const,
          label: "趋势线",
          data: trendData,
          borderColor: palette.trend,
          borderWidth: 2,
          borderDash: [6, 4],
          backgroundColor: "transparent",
          pointRadius: 0,
          tension: 0,
          spanGaps: true,
          fill: false,
          yAxisID: "y",
        }] : []),
      ];
    }
    chart.update();
  }, [filled, palette, trendData]);

  // 卸载销毁，防内存泄漏
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  // 移动端：触摸点击数据后 tooltip 会常驻，点击图表外的任意位置时主动清除
  // （Chart.js 默认不监听画布外事件，故在文档级捕获 pointerdown）
  useEffect(() => {
    const clearTooltipOutside = (e: PointerEvent) => {
      const chart = chartRef.current;
      if (!chart || e.target === canvasRef.current) return;
      if (chart.getActiveElements().length === 0) return;
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.update("none");
    };
    document.addEventListener("pointerdown", clearTooltipOutside, true);
    return () => document.removeEventListener("pointerdown", clearTooltipOutside, true);
  }, []);

  const showQualitySwitch = canBeHq;

  return (
    <Card
      className="stats-chart-card"
      size="small"
      title={<><LineChartOutlined /> 价格走势</>}
    >
      <div className="stats-chart-toolbar">
        <Segmented<QualityKey>
          value={quality}
          onChange={setQuality}
          options={
            showQualitySwitch
              ? ([
                  { label: "NQ", value: "nq" },
                  { label: "HQ", value: "hq" },
                  { label: "全部", value: "all" },
                ] as const)
              : [{ label: "NQ", value: "nq" } as const]
          }
          size="small"
        />
        <Segmented<number>
          value={rangeDays}
          onChange={setRangeDays}
          options={RANGE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          size="small"
        />
      </div>
      <div className="stats-chart-body">
        {loading ? (
          <div className="stats-chart-empty">
            <Spin />
          </div>
        ) : error ? (
          <Empty description={error} />
        ) : hasData ? (
          <canvas ref={canvasRef} className="stats-chart-canvas" />
        ) : (
          <Empty description="暂无统计数据" />
        )}
      </div>

      {/* 购买建议区（与走势合并，随品质/range/查价挂单动态更新） */}
      <Divider className="stats-chart-divider" />
      {showCollectingHint && (
        <div className="pa-collecting-hint">
          <InfoCircleOutlined /> 首次查看，数据采集中，稍后刷新可查看完整统计
        </div>
      )}
      <div className="stats-advice-title">
        <ThunderboltOutlined /> 购买建议
      </div>
      <PurchaseAdvice result={purchaseAdvice} hqOnly={hqOnly} />
    </Card>
  );
}
