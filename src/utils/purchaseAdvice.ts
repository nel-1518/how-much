import type { UniversalisHistory, UniversalisResponse } from "../types";
import type { TransactionStore } from "../types";

// 市场板购买手续费 5%
const TAX_RATE = 0.05;

// ======================== 统计工具函数 ========================

/** 排序后百分位值（线性插值） */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 
 * 低价加权 IQR 截尾均值
 * 先剔除 Q1 - 1.5*IQR 和 Q3 + 1.5*IQR 范围外的异常值，
 * 再对剩余的价格按「越低权重越高」加权平均 (weight = 1/price²)，压低参考价
 */
function lowPriceWeightedMean(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  if (sorted.length < 4) {
    // 样本太少时直接用低价加权
    const sumWeight = sorted.reduce((s, p) => s + 1 / (p * p), 0);
    const sumWeighted = sorted.reduce((s, p) => s + p * (1 / (p * p)), 0);
    return sumWeight > 0 ? sumWeighted / sumWeight : sorted.reduce((a, b) => a + b, 0) / sorted.length;
  }
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqrVal = q3 - q1;
  const lower = q1 - 1.5 * iqrVal;
  const upper = q3 + 1.5 * iqrVal;
  const filtered = sorted.filter((v) => v >= lower && v <= upper);
  if (filtered.length === 0) {
    // 全被剔除时回退到原始低价加权
    const sumWeight = sorted.reduce((s, p) => s + 1 / (p * p), 0);
    const sumWeighted = sorted.reduce((s, p) => s + p * (1 / (p * p)), 0);
    return sumWeighted / sumWeight;
  }
  // 低价加权平均：权重 = 1/price²，越便宜权重越高
  const sumWeight = filtered.reduce((s, p) => s + 1 / (p * p), 0);
  const sumWeighted = filtered.reduce((s, p) => s + p * (1 / (p * p)), 0);
  return sumWeighted / sumWeight;
}

/** 标准差 */
function stdDev(prices: number[], mean: number): number {
  if (prices.length < 2) return 0;
  const sqDiffs = prices.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (prices.length - 1));
}

/**
 * 指数加权移动平均（EWMA）
 * @param records 按时间正序排列（旧→新）
 * @param halflife 半衰期（天），默认 7 天
 */
function ewma(records: UniversalisHistory[], halflifeDays = 7): number {
  if (records.length === 0) return 0;
  const now = Date.now() / 1000;
  const halflifeSec = halflifeDays * 24 * 60 * 60;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of records) {
    const age = now - r.timestamp;
    const w = Math.pow(0.5, age / halflifeSec);
    totalWeight += w;
    weightedSum += r.pricePerUnit * w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * 价格密度聚类：找历史成交最密集的价位区间
 * 返回 [lo, hi] 主流成交价位带
 */
function priceDensityBand(sorted: number[]): [number, number] {
  if (sorted.length < 4) {
    return sorted.length > 0 ? [sorted[0], sorted[sorted.length - 1]] : [0, 0];
  }
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  return [q1, q3];
}

/**
 * 趋势检验：比较近期 vs 远期（基于指数加权均值）
 * 比简单分两段更平滑，不易被单日异常值干扰
 */
function detectTrend(
  records: UniversalisHistory[],
  sortedPrices: number[],
): "down" | "up" | "stable" {
  if (records.length < 5) return "stable";

  // 按时间正序
  const sortedByTime = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const recentEwma = ewma(sortedByTime, 3);      // 近3天半衰期，捕捉近期
  const longEwma = ewma(sortedByTime, 30);        // 近30天半衰期，反映长期

  // 用变异系数判断波动是否太大，波动大时趋势不可信
  const mean = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;
  const cv = mean > 0 ? stdDev(sortedPrices, mean) / mean : 0;

  // 高波动时放宽阈值
  const threshold = cv > 0.3 ? 0.1 : 0.05;
  const ratio = (recentEwma - longEwma) / longEwma;

  if (ratio < -threshold) return "down";
  if (ratio > threshold) return "up";
  return "stable";
}

// ======================== 类型定义 ========================

/** 购买建议评估结果 */
export interface PurchaseAdviceResult {
  /** 推荐等级: buy-推荐购买 / watch-谨慎观望 / avoid-不推荐 */
  rating: "buy" | "watch" | "avoid" | "insufficient";
  /** 一句话摘要 */
  summary: string;
  /** 详细分析数据 */
  details: {
    /** 当前最低挂单价（来自 API） */
    currentLowestPrice: number;
    /** 含5%手续费的实付价 */
    effectiveBuyPrice: number;
    /** 低价加权参考价（剔除异常值 + 低价加权） */
    weightedRefPrice: number;
    /** EWMA 指数加权均价（近期权重更高） */
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
    /** 实付价与参考价的比值 */
    priceRatio: number;
    /** 节省百分比（相对于参考价） */
    savingsPercent: number;
    /** 本地存储的历史记录条数 */
    recordCount: number;
    /** 近7天成交笔数 */
    recentWeekCount: number;
    /** 价格趋势 */
    trend: "down" | "up" | "stable";
    /** 变异系数 CV */
    cv: number;
    /** 标准差 */
    stdDev: number;
  };
}

// ======================== 主分析函数 ========================

/**
 * 分析是否值得购买
 * @param store     本地存储的全部交易记录
 * @param itemId    当前物品 ID
 * @param priceData 当前 Universalis API 返回的数据
 */
export function analyzePurchaseAdvice(
  store: TransactionStore,
  itemId: number,
  priceData: UniversalisResponse | null,
): PurchaseAdviceResult {
  const entry = store[String(itemId)];
  const localRecords: UniversalisHistory[] = entry?.records || [];
  // 本地无记录时，用当前 API 返回的交易历史作为替代
  const fallbackRecords = priceData?.recentHistory || [];
  const records: UniversalisHistory[] = localRecords.length > 0 ? localRecords : fallbackRecords;
  const currentListings = priceData?.listings || [];

  // 无足够数据
  if (currentListings.length === 0) {
    return {
      rating: "insufficient",
      summary: "暂无挂单数据，无法提供购买建议",
      details: {
        currentLowestPrice: 0,
        effectiveBuyPrice: 0,
        weightedRefPrice: 0,
        ewmaPrice: 0,
        historicalMedianPrice: 0,
        historicalLowestPrice: 0,
        lowestPriceRecord: undefined,
        historicalHighestPrice: 0,
        percentile25: 0,
        percentile75: 0,
        priceRatio: 0,
        savingsPercent: 0,
        recordCount: localRecords.length,
        recentWeekCount: 0,
        trend: "stable",
        cv: 0,
        stdDev: 0,
      },
    };
  }

  // 当前最低价（挂单价），含手续费的实付价
  const currentLowestPrice = Math.min(...currentListings.map((l) => l.pricePerUnit));
  const effectiveBuyPrice = currentLowestPrice * (1 + TAX_RATE);

  // === 历史数据分析（本地存储优先，无则用 API 返回的）===
  const prices = records.map((r) => r.pricePerUnit);
  const sorted = [...prices].sort((a, b) => a - b);
  const len = sorted.length;

  const historicalLowestPrice = len > 0 ? sorted[0] : 0;
  const historicalHighestPrice = len > 0 ? sorted[len - 1] : 0;
  // 找出历史最低价的那笔交易
  const lowestPriceRecord = len > 0
    ? records.find((r) => r.pricePerUnit === sorted[0])
    : undefined;

  // 百分位
  const percentile25 = percentile(sorted, 25);
  const percentile75 = percentile(sorted, 75);
  const historicalMedianPrice = percentile(sorted, 50);

  // 低价加权参考价（主参考基准）
  const weightedRefPrice = lowPriceWeightedMean(sorted);

  // EWMA 指数加权均价
  const ewmaPrice = len > 0 ? ewma(records, 7) : 0;

  // 波动率
  const avgPrice = len > 0 ? prices.reduce((s, p) => s + p, 0) / len : 0;
  const stdDevVal = stdDev(prices, avgPrice);
  const cv = avgPrice > 0 ? stdDevVal / avgPrice : 0;

  // 近 7 天成交笔数
  const oneWeekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
  const recentWeekRecords = records.filter((r) => r.timestamp >= oneWeekAgo);
  const recentWeekCount = recentWeekRecords.length;

  // 价格趋势
  const trend = detectTrend(records, sorted);

  // 主流成交价位带（只需 bandLo 判断是否低于主流价）
  const [bandLo] = priceDensityBand(sorted);

  // === 购买建议逻辑 ===
  // 参考价：用低价加权均值，不回退到简单平均
  const refPrice = weightedRefPrice > 0 ? weightedRefPrice : avgPrice;
  const priceRatio = refPrice > 0 ? effectiveBuyPrice / refPrice : 1;
  const savingsPercent = refPrice > 0 ? ((refPrice - effectiveBuyPrice) / refPrice) * 100 : 0;

  // 是否在主流价位范围内（用实付价判断）
  const isBelowLowBand = len >= 4 && effectiveBuyPrice < bandLo;

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
      ewmaPrice,
      historicalMedianPrice,
      historicalLowestPrice,
      lowestPriceRecord: lowestPriceRecord
        ? {
            worldName: lowestPriceRecord.worldName,
            buyerName: lowestPriceRecord.buyerName,
            timestamp: lowestPriceRecord.timestamp,
            hq: lowestPriceRecord.hq,
          }
        : undefined,
      historicalHighestPrice,
      percentile25,
      percentile75,
      priceRatio,
      savingsPercent,
      recordCount: len,
      recentWeekCount,
      trend,
      cv,
      stdDev: stdDevVal,
    },
  };
}
