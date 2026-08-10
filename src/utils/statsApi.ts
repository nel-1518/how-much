import { HISTORY_API_BASE, isWorldName } from "../constants";

/** /api/stats/daily 的每日统计项 */
export interface StatsDay {
  date: string; // 东八区 YYYY-MM-DD
  avgPrice: number;
  count: number;
  removed: number;
  min: number | null;
  max: number | null;
  median: number | null;
  volume: number;
}

export interface StatsSeries {
  quality: "nq" | "hq" | "all";
  days: StatsDay[];
}

/** 服务端返回的购买建议历史统计（每品质独立） */
export interface AdviceStats {
  /** 时间衰减加权 P25 参考价（近72h + 10%双边截尾 + 半衰期12h 加权） */
  weightedRefPrice: number;
  /** EWMA 指数加权均价（半衰期 7 天） */
  ewmaPrice: number;
  /** 历史成交价中位数 */
  historicalMedianPrice: number;
  /** 历史最低成交价 */
  historicalLowestPrice: number;
  /** 历史最低价的那笔交易详情 */
  lowestPriceRecord?: {
    worldName: string;
    buyerName: string;
    timestamp: number;
    hq: boolean;
  };
  /** 历史最高成交价 */
  historicalHighestPrice: number;
  /** P25 百分位（主流成交价位下限） */
  percentile25: number;
  /** P75 百分位（主流成交价位上限） */
  percentile75: number;
  /** 参与统计的历史记录条数 */
  recordCount: number;
  /** 近 7 天成交笔数 */
  recentWeekCount: number;
  /** 价格趋势 down/up/stable */
  trend: "down" | "up" | "stable";
  /** 变异系数 CV（标准差/均值） */
  cv: number;
  /** 标准差 */
  stdDev: number;
}

export interface DailyStatsResponse {
  itemId: number;
  itemName: string | null;
  canBeHq: boolean;
  /** 本次请求的时间范围：30 / 180 / 365 */
  range: number;
  /** 服务端是否本次首次注册（前端可提示数据采集中） */
  firstRegistration: boolean;
  series: StatsSeries[];
  /** 每品质购买建议历史统计（nq/hq/all） */
  advice: Record<"nq" | "hq" | "all", AdviceStats>;
}

/** 支持的统计范围（天）：近30天 / 半年 / 一年 */
export const STATS_RANGE_OPTIONS = [
  { label: "近30天", value: 30 },
  { label: "半年", value: 180 },
  { label: "一年", value: 365 },
] as const;

export type StatsRange = (typeof STATS_RANGE_OPTIONS)[number]["value"];

/**
 * 获取每日平均价统计（how-much-history /api/stats/daily，无鉴权）。
 * 服务端收到请求时会执行注册逻辑（首次注册并采集），返回后即可查询最新统计。
 * @param itemId 物品 ID
 * @param region 查询目标："中国"（全服，省略参数）| 大区名（region=）| 服务器名（world=）
 * @param range  时间范围：30 / 180 / 365
 */
export async function fetchDailyStats(
  itemId: number,
  region: string,
  range: number,
): Promise<DailyStatsResponse> {
  const url = new URL(`${HISTORY_API_BASE}/api/stats/daily`);
  url.searchParams.set("item", String(itemId));
  url.searchParams.set("range", String(range));
  // "中国" = 全服，服务端语义与省略参数一致；服务器走 world=，大区走 region=
  if (region && region !== "中国") {
    url.searchParams.set(isWorldName(region) ? "world" : "region", region);
  }

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new Error("无法连接历史数据服务");
  }
  if (!res.ok) {
    let message = `获取统计数据失败（HTTP ${res.status}）`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* 保留默认信息 */
    }
    throw new Error(message);
  }
  return (await res.json()) as DailyStatsResponse;
}

/** 从响应中取指定品质的 series（缺省返回空 days） */
export function pickSeries(
  resp: DailyStatsResponse | null,
  quality: "nq" | "hq" | "all",
): StatsDay[] {
  if (!resp) return [];
  return resp.series.find((s) => s.quality === quality)?.days ?? [];
}

/** 从响应中取指定品质的购买建议统计（缺省返回空对象占位） */
export function pickAdvice(
  resp: DailyStatsResponse | null,
  quality: "nq" | "hq" | "all",
): AdviceStats | null {
  if (!resp) return null;
  return resp.advice?.[quality] ?? null;
}
