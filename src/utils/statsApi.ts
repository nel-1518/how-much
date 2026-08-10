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

export interface DailyStatsResponse {
  itemId: number;
  itemName: string | null;
  canBeHq: boolean;
  series: StatsSeries[];
}

/**
 * 获取每日平均价统计（how-much-history /api/stats/daily，无鉴权）。
 * @param itemId 物品 ID
 * @param region 查询目标："中国"（全服，省略参数）| 大区名（region=）| 服务器名（world=）
 * @param days   统计最近 N 天（Unix 秒区间）
 */
export async function fetchDailyStats(
  itemId: number,
  region: string,
  days: number,
): Promise<DailyStatsResponse> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const url = new URL(`${HISTORY_API_BASE}/api/stats/daily`);
  url.searchParams.set("item", String(itemId));
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
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
