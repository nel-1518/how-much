// 大区图标
import area_luxingniao from "./assets/area_luxingniao.png";
import area_maoxiaopang from "./assets/area_maoxiaopang.png";
import area_moguli from "./assets/area_moguli.png";
import area_doudouchai from "./assets/area_doudouchai.png";

// 大区 → API 路径映射
export const REGION_MAP: Record<string, string> = {
  "中国": "china",
  "陆行鸟": "陆行鸟",
  "莫古力": "莫古力",
  "猫小胖": "猫小胖",
  "豆豆柴": "豆豆柴",
};

// 服务器 → 大区 映射
export const WORLD_TO_DC: Record<string, string> = {
  "拉诺西亚": "陆行鸟",
  "幻影群岛": "陆行鸟",
  "神意之地": "陆行鸟",
  "萌芽池": "陆行鸟",
  "红玉海": "陆行鸟",
  "宇宙和音": "陆行鸟",
  "沃仙曦染": "陆行鸟",
  "晨曦王座": "陆行鸟",
  "潮风亭": "莫古力",
  "神拳痕": "莫古力",
  "白银乡": "莫古力",
  "白金幻象": "莫古力",
  "旅人栈桥": "莫古力",
  "拂晓之间": "莫古力",
  "龙巢神殿": "莫古力",
  "梦羽宝境": "莫古力",
  "紫水栈桥": "猫小胖",
  "延夏": "猫小胖",
  "静语庄园": "猫小胖",
  "摩杜纳": "猫小胖",
  "海猫茶屋": "猫小胖",
  "柔风海湾": "猫小胖",
  "琥珀原": "猫小胖",
  "水晶塔": "豆豆柴",
  "银泪湖": "豆豆柴",
  "太阳海岸": "豆豆柴",
  "伊修加德": "豆豆柴",
  "红茶川": "豆豆柴",
};

// 国服大区名（选择器下拉顺序）
export const DC_NAMES = ["陆行鸟", "莫古力", "猫小胖", "豆豆柴"] as const;
export type DcName = (typeof DC_NAMES)[number];

// 大区 → 旗下服务器（由 WORLD_TO_DC 反推，保持单一数据源）
export const DC_WORLDS: Record<DcName, string[]> = (() => {
  const map: Record<DcName, string[]> = { "陆行鸟": [], "莫古力": [], "猫小胖": [], "豆豆柴": [] };
  for (const [world, dc] of Object.entries(WORLD_TO_DC)) {
    const dcName = dc as DcName;
    if (map[dcName]) map[dcName].push(world);
  }
  return map;
})();

/** 是否为已知服务器名 */
export function isWorldName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(WORLD_TO_DC, name);
}

/** 服务器所属大区（非服务器返回 undefined） */
export function dcOfWorld(name: string): DcName | undefined {
  return WORLD_TO_DC[name] as DcName | undefined;
}

// 大区 → 图标
export const DC_ICON_MAP: Record<string, string> = {
  "陆行鸟": area_luxingniao,
  "莫古力": area_moguli,
  "猫小胖": area_maoxiaopang,
  "豆豆柴": area_doudouchai,
};

// 搜索历史
export const HISTORY_KEY = "ff14_search_history";
export const HISTORY_PINNED_KEY = "ff14_search_history_pinned";
export const MAX_HISTORY = 30;

// 配套服务地址
export const HISTORY_API_BASE: string = "https://ffxiv-api.neeeel.com"
// export const HISTORY_API_BASE: string = "http://localhost:5174"

// Universalis 行情地址；设置中勾选"代理"后，改为通过 HISTORY_API_BASE 代访问
export const UNIVERSALIS_BASE: string = "https://universalis.app"
export const UNIVERSALIS_PROXY_BASE: string = HISTORY_API_BASE

// 上次选中大区
export const REGION_KEY = "ff14_last_region";
export const DEFAULT_REGION = "中国";

// 各大区记忆的已选服务器（JSON：{ "陆行鸟": "红玉海", ... }，缺省=大区名）
export const DC_SERVERS_KEY = "ff14_dc_servers";

// 历史侧栏
export const SIDEBAR_OPEN_KEY = "ff14_sidebar_open";
export const SIDEBAR_WIDTH_KEY = "ff14_sidebar_width";
export const MIN_SIDEBAR_W = 220;
export const MAX_SIDEBAR_W = 480;
export const DEFAULT_SIDEBAR_W = 280;

// 主题设置
export const THEME_KEY = "ff14_theme_mode";
export type ThemeMode = "auto" | "light" | "dark";

// 金额显示格式（全局）：comma=1,234,567 / space4=123 4567
export const PRICE_FORMAT_KEY = "ff14_price_format";
export type PriceFormat = "comma" | "space4";

// 是否通过代理访问 Universalis（交易数据：出售列表与交易历史）
export const USE_PROXY_KEY = "ff14_use_proxy";

// 本地物品数据库
export const ITEM_DB_VERSION_KEY = "ff14_item_db_version";
export const ITEM_DB_DATA_KEY = "ff14_item_db_data";
// 注意：如果部署在子路径下（如 http://host/how-much/），请修改基础路径
export const ITEM_DB_BASE = "/how-much/data";
export const ITEM_DB_VERSION_URL = `${ITEM_DB_BASE}/item-db.version.json`;
export const ITEM_DB_DATA_URL = `${ITEM_DB_BASE}/item-db.json`;
