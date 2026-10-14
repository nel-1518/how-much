import { useCallback, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router";
import type { BatchItem } from "../types";
import { useItemDb } from "../contexts/ItemDbContext";
import { useBatchPriceQuery } from "../hooks/useBatchPriceQuery";
import { useSavedItemSets, type SavedBatchSet } from "../hooks/useSavedItemSets";
import { PageShell } from "../components/PageShell";
import { BatchPriceSection } from "../components/BatchPriceSection";
import { BatchSetsSidebar } from "../components/BatchSetsSidebar";

/** 批量查价页：批量输入 / 已选物品 + 左侧物品集侧栏（无搜索历史） */
export function BatchPage() {
  const itemDb = useItemDb();
  const batch = useBatchPriceQuery();
  const { sets, saveSet, removeSet, clearSets } = useSavedItemSets();
  const navigate = useNavigate();

  const [setName, setSetName] = useState("");
  const [loadedSetId, setLoadedSetId] = useState<string | undefined>(undefined);

  /** 保存当前已选物品为一个物品集 */
  const handleSaveSet = useCallback(() => {
    saveSet(setName, batch.items);
  }, [saveSet, setName, batch.items]);

  /** 载入物品集：清空已选并按物品集物品重新填装 */
  const handleLoadSet = useCallback(
    (id?: string) => {
      setLoadedSetId(id);
      if (!id) return;
      const set = sets.find((s) => s.id === id);
      if (!set) return;
      batch.clear();
      setSetName(set.name);
      for (const it of set.items) batch.addByEntry(it);
      message.success("已载入物品集「" + set.name + "」");
    },
    [sets, batch],
  );

  /** 删除物品集（若正被载入则一并清除选择） */
  const handleRemoveSet = useCallback(
    (id: string) => {
      const set = sets.find((s) => s.id === id);
      removeSet(id);
      setLoadedSetId((prev) => (prev === id ? undefined : prev));
      if (set) message.success("已删除物品集「" + set.name + "」");
    },
    [sets, removeSet],
  );

  /** 侧栏点击物品集：复用载入逻辑 */
  const handleSidebarLoad = useCallback(
    (set: SavedBatchSet) => handleLoadSet(set.id),
    [handleLoadSet],
  );

  /** 侧栏一键清空：删除全部已保存物品集，并取消当前选择 */
  const handleClearSets = useCallback(() => {
    clearSets();
    setLoadedSetId(undefined);
    message.success("已清空全部物品集");
  }, [clearSets]);

  /** 打开单个查价详情：跳回主页并携带 item 参数直达 */
  const handleOpenSingleItem = useCallback(
    (item: BatchItem) => {
      navigate({ pathname: "/", search: `?item=${item.id}` });
    },
    [navigate],
  );

  return (
    <PageShell
      containerClassName="searched batch-mode"
      sidebar={
        <BatchSetsSidebar
          sets={sets}
          activeSetId={loadedSetId}
          hasSets={sets.length > 0}
          onLoad={handleSidebarLoad}
          onRemove={handleRemoveSet}
          onClearSets={handleClearSets}
        />
      }
    >
      <BatchPriceSection
        itemDb={itemDb}
        batch={batch}
        sets={sets}
        loadedSetId={loadedSetId}
        setName={setName}
        onSetNameChange={setSetName}
        onSaveSet={handleSaveSet}
        onLoadSet={handleLoadSet}
        onRemoveSet={handleRemoveSet}
        onOpenSingleItem={handleOpenSingleItem}
      />
    </PageShell>
  );
}
