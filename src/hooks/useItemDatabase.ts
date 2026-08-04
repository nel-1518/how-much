import { useState, useEffect, useRef, useCallback } from "react";
import { message } from "antd";
import type { ItemDbEntry, ItemDbVersion } from "../types";
import {
  ITEM_DB_VERSION_KEY,
  ITEM_DB_DATA_KEY,
  ITEM_DB_VERSION_URL,
  ITEM_DB_DATA_URL,
} from "../constants";

interface ItemDatabaseState {
  status: "loading" | "ready" | "error";
  errorMsg?: string;
}

/**
 * 本地物品数据库 Hook
 *
 * 职责:
 *  - 管理物品数据的版本化加载和缓存
 *  - 提供本地快速搜索（子串匹配）
 *  - 新版本静默下载，完成后弹提示
 *  - 下载失败时降级使用旧缓存
 */
export function useItemDatabase() {
  const [state, setState] = useState<ItemDatabaseState>({ status: "loading" });
  // 当前使用的数据库版本（用于设置面板展示）
  const [version, setVersion] = useState<string | null>(null);

  // 存储数据的引用（不触发重渲染）
  const itemsRef = useRef<ItemDbEntry[]>([]);
  const lowerNamesRef = useRef<string[]>([]);
  const idMapRef = useRef<Map<number, ItemDbEntry>>(new Map());
  const readyRef = useRef(false);

  const searchByName = useCallback(
    (query: string, limit = 20): ItemDbEntry[] => {
      if (!query.trim() || !readyRef.current) return [];
      const q = query.toLowerCase();
      const items = itemsRef.current;
      const names = lowerNamesRef.current;
      const results: ItemDbEntry[] = [];
      // 数据已按 id 倒序保存，从头扫描即按倒序命中，取前 limit 条即可
      for (let i = 0; i < items.length; i++) {
        if (names[i].includes(q)) {
          results.push(items[i]);
          if (results.length >= limit) break;
        }
      }
      return results;
    },
    []
  );

  const getById = useCallback((id: number): ItemDbEntry | undefined => {
    return idMapRef.current.get(id);
  }, []);

  /** 精确名称匹配（不区分大小写、忽略 FF14 特殊字符）；数据库内名称唯一，命中即唯一 */
  const findExactName = useCallback((query: string): ItemDbEntry | undefined => {
    const q = query.replace(/[\uE03C\uE0BB]/g, "").trim().toLowerCase();
    if (!q || !readyRef.current) return undefined;
    const items = itemsRef.current;
    const names = lowerNamesRef.current;
    for (let i = 0; i < items.length; i++) {
      if (names[i] === q) return items[i];
    }
    return undefined;
  }, []);

  const getItemCount = useCallback((): number => {
    return itemsRef.current.length;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 第1步：获取远程版本
        let remoteVersion: string | null = null;
        try {
          const verRes = await fetch(ITEM_DB_VERSION_URL);
          if (verRes.ok) {
            const verData: ItemDbVersion = await verRes.json();
            remoteVersion = verData.version;
          }
        } catch {
          // 版本文件获取失败，忽略，继续尝试用本地数据
        }

        const localVersion = localStorage.getItem(ITEM_DB_VERSION_KEY);
        let data: ItemDbEntry[] | null = null;
        let versionUsed: string | null = null;
        let isNewDownload = false;

        if (remoteVersion && remoteVersion !== localVersion) {
          // 版本不一致或首次加载 → 下载新数据
          try {
            const dataRes = await fetch(ITEM_DB_DATA_URL);
            if (dataRes.ok) {
              data = await dataRes.json();
              versionUsed = remoteVersion;
              isNewDownload = true;
              // 存入本地缓存
              localStorage.setItem(ITEM_DB_DATA_KEY, JSON.stringify(data));
              localStorage.setItem(ITEM_DB_VERSION_KEY, remoteVersion);
            }
          } catch {
            // 下载失败，尝试用本地缓存
          }
        }

        if (!data && localVersion) {
          // 尝试从本地缓存加载
          const cached = localStorage.getItem(ITEM_DB_DATA_KEY);
          if (cached) {
            try {
              data = JSON.parse(cached) as ItemDbEntry[];
              versionUsed = localVersion;
            } catch {
              // 缓存损坏，清空
              localStorage.removeItem(ITEM_DB_DATA_KEY);
              localStorage.removeItem(ITEM_DB_VERSION_KEY);
            }
          }
        }

        // 仍然没有数据 → 错误状态
        if (!data || data.length === 0) {
          if (!cancelled) {
            setState({
              status: "error",
              errorMsg: "物品数据库加载失败，请刷新页面重试",
            });
          }
          return;
        }

        // 构建索引：按 id 倒序保存（新物品在前），搜索时无需全量匹配即可按倒序返回
        itemsRef.current = [...data].sort((a, b) => b.id - a.id);
        const map = new Map<number, ItemDbEntry>();
        const lowerNames = new Array<string>(data.length);
        let nameIdx = 0;
        for (const item of itemsRef.current) {
          map.set(item.id, item);
          lowerNames[nameIdx++] = item.name.toLowerCase();
        }
        idMapRef.current = map;
        lowerNamesRef.current = lowerNames;
        readyRef.current = true;

        if (!cancelled) {
          setVersion(versionUsed);
          setState({ status: "ready" });

          // 新下载完成后弹提示
          if (isNewDownload) {
            message.success(
              `物品数据库已更新（版本: ${versionUsed}，共 ${data.length} 条）`
            );
          }
          // 使用旧缓存时弹提示
          if (!isNewDownload && remoteVersion && remoteVersion !== localVersion) {
            message.info("使用本地缓存数据，网络恢复后将自动更新");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            errorMsg: `物品数据库初始化失败: ${(err as Error).message}`,
          });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    status: state.status,
    errorMsg: state.errorMsg,
    ready: state.status === "ready",
    version,
    searchByName,
    getById,
    findExactName,
    getItemCount,
  };
}
