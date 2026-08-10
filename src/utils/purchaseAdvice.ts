import type { UniversalisListing } from "../types";
import type { AdviceStats } from "./statsApi";

// 市场板购买手续费 5%
const TAX_RATE = 0.05;

// ======================== 类型定义 ========================

/** 购买建议评估结果 */
export interface PurchaseAdviceResult {
  /** 推荐等级: buy-推荐购买 / watch-谨慎观望 / avoid-不推荐 / insufficient-数据不足 */
  rating: "buy" | "watch" | "avoid" | "insufficient";
  /** 一句话摘要 */
  summary: string;
  /** 详细分析数据（历史维度来自服务端 advice，挂单维度来自前端查价） */
  details: {
    /** 当前最低挂单价（来自前端查价 listings） */
    currentLowestPrice: number;
    /** 含5%手续费的实付价 */
    effectiveBuyPrice: number;
    /** 时间衰减加权 P25 参考价（服务端） */
    weightedRefPrice: number;
    /** EWMA 指数加权均价（服务端） */
    ewmaPrice: number;
    /** 历史成交价中位数（服务端） */
    historicalMedianPrice: number;
    /** 历史最低成交价（服务端） */
    historicalLowestPrice: number;
    /** 历史最低价的那笔交易详情（服务端） */
    lowestPriceRecord?: {
      worldName: string;
      buyerName: string;
      timestamp: number;
      hq: boolean;
    };
    /** 历史最高成交价（服务端） */
    historicalHighestPrice: number;
    /** P25 百分位（主流成交价位下限，服务端） */
    percentile25: number;
    /** P75 百分位（主流成交价位上限，服务端） */
    percentile75: number;
    /** 实付价与参考价的比值 */
    priceRatio: number;
    /** 节省百分比（相对于参考价） */
    savingsPercent: number;
    /** 服务端历史记录条数（当前 range/品质） */
    recordCount: number;
    /** 近7天成交笔数（服务端） */
    recentWeekCount: number;
    /** 价格趋势（服务端） */
    trend: "down" | "up" | "stable";
    /** 变异系数 CV（服务端） */
    cv: number;
    /** 标准差（服务端） */
    stdDev: number;
  };
}

// ======================== 主分析函数 ========================

/**
 * 分析是否值得购买（纯前端评级）。
 * 历史统计维度由服务端 /api/stats/daily 返回的 advice 提供（按当前 range/品质/区服），
 * 当前挂单维度由前端查价结果（listings）提供；两者无先后依赖，任一方更新后重新调用即可。
 *
 * @param statsAdvice 服务端返回的当前品质购买建议统计（可能为 null=统计未返回）
 * @param listings    前端查价结果的挂单列表（可能为空=查价未返回或无挂单）
 * @param hqOnly      仅统计 HQ 交易（挂单只看 HQ，服务端 advice 已按品质计算）
 */
export function analyzePurchaseAdvice(
  statsAdvice: AdviceStats | null,
  listings: UniversalisListing[],
  hqOnly = false,
): PurchaseAdviceResult {
  // 只统计 HQ 时挂单只看 HQ（API 已过滤时全为 HQ，这里兜底）
  const currentListings = hqOnly ? listings.filter((l) => l.hq) : listings;
  const advice = statsAdvice;

  // 无足够数据（挂单为空 → 无法给出基于当前价格的建议）
  if (currentListings.length === 0) {
    return {
      rating: "insufficient",
      summary: "暂无挂单数据，无法提供购买建议",
      details: {
        currentLowestPrice: 0,
        effectiveBuyPrice: 0,
        weightedRefPrice: advice?.weightedRefPrice ?? 0,
        ewmaPrice: advice?.ewmaPrice ?? 0,
        historicalMedianPrice: advice?.historicalMedianPrice ?? 0,
        historicalLowestPrice: advice?.historicalLowestPrice ?? 0,
        lowestPriceRecord: advice?.lowestPriceRecord,
        historicalHighestPrice: advice?.historicalHighestPrice ?? 0,
        percentile25: advice?.percentile25 ?? 0,
        percentile75: advice?.percentile75 ?? 0,
        priceRatio: 0,
        savingsPercent: 0,
        recordCount: advice?.recordCount ?? 0,
        recentWeekCount: advice?.recentWeekCount ?? 0,
        trend: advice?.trend ?? "stable",
        cv: advice?.cv ?? 0,
        stdDev: advice?.stdDev ?? 0,
      },
    };
  }

  // 当前最低价（挂单价），含手续费的实付价
  const currentLowestPrice = Math.min(...currentListings.map((l) => l.pricePerUnit));
  const effectiveBuyPrice = currentLowestPrice * (1 + TAX_RATE);

  const weightedRefPrice = advice?.weightedRefPrice ?? 0;
  const recordCount = advice?.recordCount ?? 0;
  const trend = advice?.trend ?? "stable";
  const cv = advice?.cv ?? 0;

  // 参考价：时间衰减加权 P25（服务端）；无历史时退回 EWMA 或 0
  const refPrice = weightedRefPrice > 0
    ? weightedRefPrice
    : (advice?.ewmaPrice && advice.ewmaPrice > 0 ? advice.ewmaPrice : 0);
  const priceRatio = refPrice > 0 ? effectiveBuyPrice / refPrice : 1;
  const savingsPercent = refPrice > 0 ? ((refPrice - effectiveBuyPrice) / refPrice) * 100 : 0;

  // 是否在主流价位范围内（用实付价判断；P25 为低位带下界）
  const isBelowLowBand = recordCount >= 4 && effectiveBuyPrice < (advice?.percentile25 ?? 0);

  let rating: "buy" | "watch" | "avoid" | "insufficient";
  let summary: string;

  if (refPrice === 0) {
    rating = "watch";
    summary = "暂无历史交易记录，建议观望";
  } else if (priceRatio <= 0.80) {
    rating = "buy";
    const note = isBelowLowBand ? "，远低于主流成交价" : "";
    summary = `实付价低于参考价 ${Math.abs(savingsPercent).toFixed(1)}%${note}，强烈推荐入手`;
  } else if (priceRatio <= 0.90) {
    rating = "buy";
    const note = isBelowLowBand ? "，低于主流成交价" : "";
    summary = `实付价低于参考价${note}，可以考虑购买`;
  } else if (priceRatio <= 1.00) {
    if (trend === "down") {
      rating = "watch";
      summary = "实付价接近参考价但呈下降趋势，建议观望等待更低价格";
    } else {
      rating = "watch";
      summary = "实付价与参考价持平，加上手续费后性价比不高，建议观望";
    }
  } else {
    const overPercent = ((priceRatio - 1) * 100).toFixed(1);
    if (cv > 0.3) {
      rating = "watch";
      summary = `实付价高于参考价 ${overPercent}%，但价格波动较大，可等待回落`;
    } else if (trend === "down") {
      rating = "watch";
      summary = `实付价高于参考价 ${overPercent}%，但价格呈下降趋势，建议等待`;
    } else {
      rating = "avoid";
      summary = `实付价高于参考价 ${overPercent}%（含5%手续费），不推荐购买`;
    }
  }

  return {
    rating,
    summary,
    details: {
      currentLowestPrice,
      effectiveBuyPrice,
      weightedRefPrice,
      ewmaPrice: advice?.ewmaPrice ?? 0,
      historicalMedianPrice: advice?.historicalMedianPrice ?? 0,
      historicalLowestPrice: advice?.historicalLowestPrice ?? 0,
      lowestPriceRecord: advice?.lowestPriceRecord,
      historicalHighestPrice: advice?.historicalHighestPrice ?? 0,
      percentile25: advice?.percentile25 ?? 0,
      percentile75: advice?.percentile75 ?? 0,
      priceRatio,
      savingsPercent,
      recordCount,
      recentWeekCount: advice?.recentWeekCount ?? 0,
      trend,
      cv,
      stdDev: advice?.stdDev ?? 0,
    },
  };
}
