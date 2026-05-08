/**
 * 格式化价格显示：带 Gil 后缀，小数部分弱化
 * 例：123456 → "123,456 Gil"  1234.5 → "1,234.50 Gil"
 */
export function fmtPrice(price: number) {
  const parts = price.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).split(".");
  if (parts.length === 1) {
    return <>{parts[0]}<span className="so-gil"> Gil</span></>;
  }
  return <>{parts[0]}<span className="so-dec">.{parts[1]}</span><span className="so-gil"> Gil</span></>;
}
