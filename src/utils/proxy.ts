import { USE_PROXY_KEY } from "../constants";

/** 读取本地存储的"代理"开关（勾选 = 通过代理访问 Universalis） */
export function loadUseProxy(): boolean {
  try {
    return localStorage.getItem(USE_PROXY_KEY) === "1";
  } catch { /* ignore */ }
  return false;
}

/** 保存"代理"开关到本地存储 */
export function saveUseProxy(use: boolean): void {
  try {
    localStorage.setItem(USE_PROXY_KEY, use ? "1" : "0");
  } catch { /* ignore */ }
}
