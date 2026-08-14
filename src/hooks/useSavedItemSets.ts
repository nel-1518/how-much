import { useState, useCallback } from "react";
import { message } from "antd";
import type { BatchItem } from "../types";

export interface SavedBatchSet {
  id: string;
  name: string;
  items: BatchItem[];
  savedAt: number;
}

const SETS_KEY = "ff14_batch_sets";
const MAX_SETS = 20;

function loadSets(): SavedBatchSet[] {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SavedBatchSet =>
        !!s && typeof s.name === "string" && Array.isArray(s.items),
    );
  } catch {
    return [];
  }
}

function persist(sets: SavedBatchSet[]) {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(sets));
  } catch {
    /* 忽略存储失败 */
  }
}

/**
 * 已保存的批量查价物品集：按名称保存/覆盖、按 id 删除，最多保留 MAX_SETS 个（新的在前）。
 */
export function useSavedItemSets() {
  const [sets, setSets] = useState<SavedBatchSet[]>(loadSets);

  /** 保存当前物品集（同名覆盖）；成功返回 true */
  const saveSet = useCallback(
    (name: string, items: BatchItem[]): boolean => {
      const trimmed = name.trim();
      if (!trimmed) {
        message.warning("请先输入物品集名称");
        return false;
      }
      if (items.length === 0) {
        message.warning("物品集为空，无法保存");
        return false;
      }
      const others = sets.filter((s) => s.name !== trimmed);
      const next = [
        { id: String(Date.now()), name: trimmed, items, savedAt: Date.now() },
        ...others,
      ].slice(0, MAX_SETS);
      setSets(next);
      persist(next);
      message.success("已保存物品集「" + trimmed + "」");
      return true;
    },
    [sets],
  );

  /** 删除指定物品集 */
  const removeSet = useCallback((id: string) => {
    setSets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { sets, saveSet, removeSet };
}
