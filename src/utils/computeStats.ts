import type { UniversalisResponse } from "../types";

/** 行情统计数据 */
export interface PriceStats {
  lowestPrice: number;
  avgPrice: number;
  medianPrice: number;
  trimmedMeanPrice: number;
  recentAvgPrice: number;
  listingCount: number;
  historyCount: number;
}

/**
 * 从 Universalis 数据计算行情统计
 * - 最低单价、10% 截尾均价、中位数、近期成交均价
 */
export function computeStats(data: UniversalisResponse | null): PriceStats {
  const listings = data?.listings || [];
  const history = data?.recentHistory || [];
  const prices = listings.map((l) => l.pricePerUnit);
  const sorted = [...prices].sort((a, b) => a - b);
  const len = sorted.length;

  const lowestPrice = sorted[0] || 0;
  const avgPrice = len > 0 ? prices.reduce((s, p) => s + p, 0) / len : 0;
  const mid = Math.floor(len / 2);
  const medianPrice = len > 0
    ? len % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    : 0;

  const historyPrices = history.map((h) => h.pricePerUnit);
  const recentAvgPrice = historyPrices.length > 0
    ? historyPrices.reduce((s, p) => s + p, 0) / historyPrices.length
    : 0;

  const trimCount = len >= 5 ? Math.max(1, Math.floor(len * 0.1)) : 0;
  const trimmed = trimCount > 0 ? sorted.slice(trimCount, len - trimCount) : sorted;
  const trimmedMeanPrice = trimmed.length > 0
    ? trimmed.reduce((s, p) => s + p, 0) / trimmed.length
    : avgPrice;

  return { lowestPrice, avgPrice, medianPrice, trimmedMeanPrice, recentAvgPrice, listingCount: len, historyCount: history.length };
}
