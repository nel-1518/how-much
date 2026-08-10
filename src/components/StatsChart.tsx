import { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "chart.js/auto";
import type { Plugin } from "chart.js";
import { Empty, Segmented, Spin, message } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import { fetchDailyStats, pickSeries, type DailyStatsResponse, type StatsDay } from "../utils/statsApi";
import { formatPrice, getCurrentPriceFormat } from "../utils/priceFormat";

/** 时间范围选项：近 7 天 / 15 天 / 30 天 / 半年 / 一年（一年=365 天，规避服务端 366 天上限） */
const RANGE_OPTIONS = [
  { label: "近7天", value: 7 },
  { label: "近15天", value: 15 },
  { label: "近30天", value: 30 },
  { label: "半年", value: 180 },
  { label: "一年", value: 365 },
];

type QualityKey = "nq" | "hq" | "all";

/** 东八区 YYYY-MM-DD 递增 1 天 */
function addDay(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
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
  /** 当前是否为深色主题（图表配色适配） */
  isDark: boolean;
}

/** 主题色（与 AppWrapper token 保持一致） */
const COLOR_PRICE = "#8b5cf6"; // 紫（--accent），平均价主线
const COLOR_PRICE_DARK = "#a78bfa";
// 最高/最低价区间线：灰色系并减淡（与紫色主线形成层次）
const COLOR_RANGE_LIGHT = "rgba(120,113,127,0.2)";
const COLOR_RANGE_DARK = "rgba(176,174,184,0.25)";
// 区间带填充色（更低透明度）
const RANGE_FILL_LIGHT = "rgba(120,113,127,0.07)";
const RANGE_FILL_DARK = "rgba(176,174,184,0.08)";
const GRID_LIGHT = "rgba(0,0,0,0.06)";
const GRID_DARK = "rgba(255,255,255,0.08)";
const TEXT_LIGHT = "#78717f";
const TEXT_DARK = "#b0aeb8";
// 周末分隔虚线（垂直，画在周六/周日刻度处）；颜色随主题切换（模块级变量，插件每次绘制读取）
const WEEKEND_LINE_LIGHT = "rgba(120,113,127,0.35)";
const WEEKEND_LINE_DARK = "rgba(176,174,184,0.35)";
let weekendLineColor = WEEKEND_LINE_LIGHT;

/**
 * 自定义插件：在周六/周日刻度位置画垂直虚线，区分工作日与周末。
 */
const weekendSeparatorPlugin: Plugin = {
  id: "weekendSeparator",
  beforeDraw(chart) {
    if (!weekendLineColor) return;
    const xScale = chart.scales.x;
    const area = chart.chartArea;
    const labels = chart.data.labels as string[] | undefined;
    if (!xScale || !labels || labels.length === 0 || !area) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = weekendLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < labels.length; i++) {
      // date 为东八区 YYYY-MM-DD，用 UTC 解析避免本地时区偏移；周六=6 周日=0
      const dow = new Date(`${labels[i]}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) {
        const x = xScale.getPixelForValue(i);
        ctx.beginPath();
        ctx.moveTo(x, area.top);
        ctx.lineTo(x, area.bottom);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

/**
 * 从较大跨度的响应中截取最近 N 天（东八区日期过滤，与服务端聚合口径一致）。
 * 用于缓存复用：已缓存 365 天时选 7/15/30 天无需再次请求。
 */
function sliceDays(resp: DailyStatsResponse, rangeDays: number): DailyStatsResponse {
  // 东八区当前时间（与 stats.ts CN_OFFSET_MS 一致）
  const now = new Date(Date.now() + 8 * 3600_000);
  now.setUTCDate(now.getUTCDate() - rangeDays);
  const cutoff = now.toISOString().slice(0, 10);
  return {
    ...resp,
    series: resp.series.map((s) => ({
      ...s,
      days: s.days.filter((d) => d.date >= cutoff),
    })),
  };
}

/**
 * 统计图栏：最高/最低价区间带 + 平均价主线，数据来自 /api/stats/daily。
 * - 时间范围：近7天/15天/30天/半年/一年
 * - 品质：hq=0 固定 nq；hq=1 默认 hq，可切换 nq/hq/all（切换不重新请求）
 * - 缓存：按 item+region 缓存最大跨度响应；选更小跨度时直接截取复用（跨度更大才重新请求）
 */
export function StatsChart({ itemId, region, canBeHq, isDark }: StatsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const cacheRef = useRef<Map<string, { rangeDays: number; resp: DailyStatsResponse }>>(new Map());
  const [rangeDays, setRangeDays] = useState(7);
  const [quality, setQuality] = useState<QualityKey>(canBeHq ? "hq" : "nq");
  const [resp, setResp] = useState<DailyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 品质默认值跟随物品的 canBeHq（hq=0 → 固定 nq）：
  // 在渲染期间检测 props 变化并调整 state（React 官方模式，避免在 effect 中 setState）
  const [prevCanBeHq, setPrevCanBeHq] = useState(canBeHq);
  if (canBeHq !== prevCanBeHq) {
    setPrevCanBeHq(canBeHq);
    setQuality(canBeHq ? "hq" : "nq");
  }

  // 数据获取：按 item+region 缓存最大跨度响应；小跨度直接从缓存截取，不重复请求
  useEffect(() => {
    const cacheKey = `${itemId}-${region}`;
    const cached = cacheRef.current.get(cacheKey);
    // 缓存跨度 >= 当前跨度：直接截取最近 N 天复用
    if (cached && cached.rangeDays >= rangeDays) {
      setResp(sliceDays(cached.resp, rangeDays));
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDailyStats(itemId, region, rangeDays)
      .then((data) => {
        if (cancelled) return;
        // 新请求跨度更大（或无缓存）时更新缓存，保留已有的大跨度数据
        if (!cached || rangeDays > cached.rangeDays) {
          cacheRef.current.set(cacheKey, { rangeDays, resp: data });
        }
        setResp(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setResp(null);
        setError(err instanceof Error ? err.message : "获取统计数据失败");
        message.error(err instanceof Error ? err.message : "获取统计数据失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, region, rangeDays]);

  // 当前展示的数据：品质切换在响应内完成，无需重新请求；按天补全缺失日期使时间轴平均分布
  const filled = useMemo(() => fillDailySeries(pickSeries(resp, quality)), [resp, quality]);
  const days = filled.days;
  const hasData = resp !== null && filled.labels.length > 0 && days.some((d) => d !== null);

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
    const priceColor = isDark ? COLOR_PRICE_DARK : COLOR_PRICE;
    const rangeColor = isDark ? COLOR_RANGE_DARK : COLOR_RANGE_LIGHT;
    const rangeFill = isDark ? RANGE_FILL_DARK : RANGE_FILL_LIGHT;
    const gridColor = isDark ? GRID_DARK : GRID_LIGHT;
    const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;
    // 主题变化时更新周末分隔虚线颜色（插件每次绘制时读取）
    weekendLineColor = isDark ? WEEKEND_LINE_DARK : WEEKEND_LINE_LIGHT;

    if (!chartRef.current) {
      chartRef.current = new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        plugins: [weekendSeparatorPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
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
              ticks: { color: textColor, maxTicksLimit: 8 },
              grid: { color: gridColor },
            },
            y: {
              position: "left",
              title: { display: true, text: "价格 (Gil)", color: textColor },
              ticks: {
                color: textColor,
                callback: (value) => {
                  // 轴刻度应用全局金额格式（避免过长刻度挤压图表）
                  const num = Number(value);
                  return Number.isFinite(num) ? formatPrice(num, getCurrentPriceFormat()) : value;
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
      ];
    }
    chart.update();
  }, [filled, isDark]);

  // 卸载销毁，防内存泄漏
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const showQualitySwitch = canBeHq;

  return (
    <div className="stats-chart-card">
      <div className="stats-chart-toolbar">
        <span className="stats-chart-title">
          <LineChartOutlined style={{ marginRight: 6 }} />
          价格走势
        </span>
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
    </div>
  );
}
