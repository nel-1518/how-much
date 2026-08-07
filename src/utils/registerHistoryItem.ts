import { HISTORY_API_BASE } from "../constants";

/**
 * 向 how-much-history 服务注册商品。
 *
 * 每次从 Universalis 获取商品信息时同步调用；
 * 失败只记录日志，绝不影响查价主流程。
 */
export function registerHistoryItem(itemId: number, name?: string): void {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  const qs = params.toString();
  fetch(`${HISTORY_API_BASE}/api/items/${itemId}/register${qs ? `?${qs}` : ""}`)
    .then((res) => {
      if (!res.ok) {
        console.warn(`[how-much-history] 注册商品 #${itemId} 失败：HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      console.warn(`[how-much-history] 注册商品 #${itemId} 失败：`, err);
    });
}