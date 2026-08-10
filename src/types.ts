// ---- 物品搜索结果（由本地物品库生成，结构兼容旧 XIVAPI 搜索） ----
export interface ItemResult {
  score: number;
  sheet: string;
  row_id: number;
  /** 物品名称 */
  fields: { Name: string };
  /** 物品是否存在 HQ 品质（来自本地物品库；非 XIVAPI 字段，可选） */
  canBeHq?: boolean;
}

// ---- Universalis 查价 ----
export interface UniversalisListing {
  worldName: string;
  hq: boolean;
  pricePerUnit: number;
  quantity: number;
  total: number;
}

export interface UniversalisHistory {
  worldName: string;
  hq: boolean;
  pricePerUnit: number;
  quantity: number;
  total: number;
  buyerName: string;
  timestamp: number;
  /** 是否从人偶展示架购买（可能为 null/undefined）；统计时应过滤 */
  onMannequin?: boolean | null;
}

export interface UniversalisResponse {
  itemID?: number;
  /** 单服务器查询时顶层返回的服务器名（大区/中国查询时可能缺失，条目级 worldName 会补全） */
  worldName?: string;
  listings?: UniversalisListing[];
  recentHistory?: UniversalisHistory[];
}

// ---- 本地物品数据库 ----
export interface ItemDbEntry {
  id: number;
  name: string;
  /** 1 = 该物品存在 HQ 品质（可被制作为 HQ），0 = 无 HQ */
  hq: 0 | 1;
}

export interface ItemDbVersion {
  version: string;
  itemCount: number;
  generated: string;
}

// ---- 搜索历史 ----
export interface SearchHistoryItem {
  id: number;
  name: string;
  time: number;
  pinned?: boolean;
}


