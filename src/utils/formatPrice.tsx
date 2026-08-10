import { formatPrice, getCurrentPriceFormat } from "./priceFormat";

/**
 * 格式化价格显示：带 Gil 后缀，小数部分弱化，整数部分按全局金额格式（千分位/四位一组/万位中文）
 * 例（千分位）：123456 → "123,456 Gil"  1234.5 → "1,234.50 Gil"
 */
export function fmtPrice(price: number) {
  const format = getCurrentPriceFormat();
  // 小数部分单独处理（全局格式只作用于整数部分）
  const hasDec = !Number.isInteger(price);
  const intPart = formatPrice(Math.floor(price), format);
  if (!hasDec) {
    return <>{intPart}<span className="so-gil"> Gil</span></>;
  }
  const dec = (price - Math.floor(price)).toFixed(2).slice(1);
  return <>{intPart}<span className="so-dec">{dec}</span><span className="so-gil"> Gil</span></>;
}
