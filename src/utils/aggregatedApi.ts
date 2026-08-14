import { REGION_MAP, UNIVERSALIS_BASE, UNIVERSALIS_PROXY_BASE } from "../constants";
import { loadUseProxy } from "./proxy";
import type { AggregatedResponse } from "../types";

/** 一次批量查价最多允许的物品数 */
export const MAX_BATCH_ITEMS = 100;

/** 查询范围 -> Universalis 路径（与单个查价一致） */
export function buildAggregatedPath(scope: string): string {
  return REGION_MAP[scope] ?? scope;
}

/** 组装聚合查价 URL（勾选代理时走服务端代理） */
export function buildAggregatedUrl(scope: string, itemIds: number[]): string {
  const path = buildAggregatedPath(scope);
  const base = loadUseProxy() ? UNIVERSALIS_PROXY_BASE : UNIVERSALIS_BASE;
  return base + "/api/v2/aggregated/" + encodeURIComponent(path) + "/" + itemIds.join(",");
}

/** 批量查价：去重、截断到上限，失败抛错供上层提示 */
export async function fetchAggregated(scope: string, itemIds: number[]): Promise<AggregatedResponse> {
  const ids = Array.from(new Set(itemIds)).slice(0, MAX_BATCH_ITEMS);
  if (ids.length === 0) throw new Error("没有可查询的物品");
  const url = buildAggregatedUrl(scope, ids);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new Error("无法连接行情服务");
  }
  if (!res.ok) throw new Error("查询失败（HTTP " + res.status + "）");
  return (await res.json()) as AggregatedResponse;
}
