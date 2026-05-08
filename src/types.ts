// ---- XIVAPI 搜索 ----
export interface ItemFields {
  Icon?: { id: number; path: string; path_hr1: string };
  Name: string;
  Singular: string;
}

export interface ItemResult {
  score: number;
  sheet: string;
  row_id: number;
  fields: ItemFields;
}

export interface SearchResponse {
  schema?: string;
  version?: string;
  results?: ItemResult[];
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
}

export interface UniversalisResponse {
  itemID?: number;
  listings?: UniversalisListing[];
  recentHistory?: UniversalisHistory[];
}

// ---- 搜索历史 ----
export interface SearchHistoryItem {
  id: number;
  name: string;
  time: number;
  pinned?: boolean;
}
