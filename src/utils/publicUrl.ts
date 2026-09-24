/**
 * 拼接 public 目录下静态资源的 URL，自动适配 Vite 配置的 base 路径。
 *
 * 使用场景：fetch 加载 public/ 中的静态文件（如 JSON 数据、图标等）时，
 * 通过该函数生成完整 URL，避免硬编码部署子路径（如 `/how-much/`），
 * 让项目能在根路径（vite build --base=/）和子路径部署之间无缝切换。
 *
 * 示例（base='/how-much/'）：
 *   publicUrl("data/item-db.version.json")  → "/how-much/data/item-db.version.json"
 *   publicUrl("/data/item-db.json")        → "/how-much/data/item-db.json"
 *
 * 示例（base='/'）：
 *   publicUrl("coin.png")                  → "/coin.png"
 *
 * @param path 相对 public 目录的路径，可带或不带前导 "/"
 * @returns 拼接 base 后的完整 URL（始终以 "/" 开头）
 */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith("/") ? base : base + "/";
  const normalizedPath = path.replace(/^\/+/, "");
  return normalizedBase + normalizedPath;
}