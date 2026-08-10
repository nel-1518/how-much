import { PRICE_FORMAT_KEY, type PriceFormat } from "../constants";

/** 读取本地存储的金额显示格式（非法值/旧值回退默认） */
export function loadPriceFormat(): PriceFormat {
  try {
    const v = localStorage.getItem(PRICE_FORMAT_KEY);
    if (v === "comma" || v === "space4") return v;
  } catch { /* ignore */ }
  return "comma";
}

/** 保存金额显示格式到本地存储 */
export function savePriceFormat(format: PriceFormat): void {
  try {
    localStorage.setItem(PRICE_FORMAT_KEY, format);
  } catch { /* ignore */ }
}

/** 读取当前金额格式（直接读本地存储；保存后刷新页面生效，不做实时刷新） */
export function getCurrentPriceFormat(): PriceFormat {
  return loadPriceFormat();
}

/**
 * 格式化金额（全局显示格式）。
 * - comma:   1,234,567（千分位）
 * - space4:  123 4567（四位一组，空格分隔）
 */
export function formatPrice(value: number, format: PriceFormat): string {
  const v = Math.floor(Math.abs(value));
  const sign = value < 0 ? "-" : "";

  if (format === "space4") {
    const s = String(v);
    const groups: string[] = [];
    for (let i = s.length; i > 0; i -= 4) {
      groups.unshift(s.slice(Math.max(0, i - 4), i));
    }
    return `${sign}${groups.join(" ")}`;
  }

  // comma：千分位（整数部分）
  return `${sign}${v.toLocaleString("en-US")}`;
}
