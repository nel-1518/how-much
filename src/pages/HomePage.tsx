import { useState, useCallback, useMemo, useRef, type ComponentRef } from "react";
import type { Input } from "antd";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { usePriceQuery } from "../hooks/usePriceQuery";
import { useItemSearch } from "../hooks/useItemSearch";
import { useUrlQueryOpen } from "../hooks/useUrlQueryOpen";
import { useGlobalSearchHotkeys } from "../hooks/useGlobalSearchHotkeys";
import { HeroSection } from "../components/HeroSection";
import { SearchCard } from "../components/SearchCard";
import { HistorySection } from "../components/HistorySection";
import { HistorySidebar } from "../components/HistorySidebar";
import { PriceSection } from "../components/PriceSection";
import { PageShell } from "../components/PageShell";
import { useRegionScopeContext } from "../contexts/RegionScopeContext";
import { useItemDb } from "../contexts/ItemDbContext";
import { useDialogs } from "../contexts/DialogsContext";
import { SearchHistoryProvider, type SearchHistoryValue } from "../contexts/SearchHistoryContext";

/** 主页（单个查价）：顶部搜索 + 首页历史 / 查价结果 + 搜索历史侧栏 */
export function HomePage() {
  const { scope, setScope, selectServer } = useRegionScopeContext();
  const { settingsOpen, infoOpen } = useDialogs();
  // 是否由 Tab 打开卡片（决定卡片输入框是否自动聚焦）
  const [focusCardOnOpen, setFocusCardOnOpen] = useState(false);

  const itemDb = useItemDb();
  const { findExactName } = itemDb;
  const historyHooks = useSearchHistory();
  const priceHooks = usePriceQuery();
  const searchHooks = useItemSearch({
    region: scope,
    fetchPriceData: priceHooks.fetchPriceData,
    addToHistory: historyHooks.addToHistory,
    clearPrice: priceHooks.clearPrice,
    itemDb,
  });
  const { setActiveIndex, setShowResults, handleKeywordChange, selectByDbEntry } = searchHooks;

  // URL 直达：?item=<id|名称>&world=<id|名称>（仅给 item 时沿用默认范围；只有 world 则无效）
  useUrlQueryOpen({
    itemDb,
    defaultScope: scope,
    openItem: selectByDbEntry,
    selectServer,
    setScope,
  });

  // 顶部搜索输入框引用（键盘唤起时聚焦 / 切换 Tab 时读取内容）
  const topInputRef = useRef<ComponentRef<typeof Input> | null>(null);

  const closeSearchCard = useCallback(() => {
    setShowResults(false);
  }, [setShowResults]);

  /** 顶部输入框内容变化：按输入方式打开卡片（不自动聚焦卡片输入框） */
  const handleTopKeywordChange = useCallback((v: string) => {
    setFocusCardOnOpen(false);
    handleKeywordChange(v);
  }, [handleKeywordChange]);

  // 全局键盘与粘贴快捷键（Esc / Tab / 字母唤起 / IME 组合 / 粘贴接管；侧栏开关由侧栏处理）
  useGlobalSearchHotkeys({
    showResults: searchHooks.showResults,
    viewMode: "single",
    settingsOpen,
    infoOpen,
    topInputRef,
    closeSearchCard,
    setFocusCardOnOpen,
    onKeywordChange: handleKeywordChange,
    setActiveIndex,
    setShowResults,
    findExactName,
    selectByDbEntry,
  });

  // 搜索历史上下文：数据来自 useSearchHistory，选中 / 回搜来自 useItemSearch
  const historyValue = useMemo<SearchHistoryValue>(
    () => ({
      sortedHistory: historyHooks.sortedHistory,
      activeItemId: searchHooks.selectedItem?.row_id ?? null,
      searchFromHistory: searchHooks.searchFromHistory,
      removeHistory: historyHooks.removeHistory,
      clearHistory: historyHooks.clearHistory,
      togglePin: historyHooks.togglePin,
    }),
    [
      historyHooks.sortedHistory,
      historyHooks.removeHistory,
      historyHooks.clearHistory,
      historyHooks.togglePin,
      searchHooks.selectedItem,
      searchHooks.searchFromHistory,
    ],
  );

  return (
    <SearchHistoryProvider value={historyValue}>
      <PageShell
        containerClassName={searchHooks.hasSearched ? "searched" : ""}
        sidebar={<HistorySidebar />}
        overlay={
          searchHooks.showResults ? (
            <SearchCard
              keyword={searchHooks.keyword}
              results={searchHooks.results}
              loading={searchHooks.loading}
              activeIndex={searchHooks.activeIndex}
              dbStatus={itemDb.status}
              focusOnMount={focusCardOnOpen}
              onKeywordChange={searchHooks.handleKeywordChange}
              onSearch={searchHooks.doSearch}
              onSelectItem={searchHooks.handleSelectItem}
              onMoveActive={searchHooks.moveActiveIndex}
              onActivate={searchHooks.setActiveIndex}
              onClose={closeSearchCard}
            />
          ) : null
        }
        search={{
          keyword: searchHooks.keyword,
          results: searchHooks.results,
          loading: searchHooks.loading,
          activeIndex: searchHooks.activeIndex,
          dbStatus: itemDb.status,
          inputRef: topInputRef,
          onKeywordChange: handleTopKeywordChange,
          onSearch: searchHooks.doSearch,
          onSelectItem: searchHooks.handleSelectItem,
          onMoveActive: searchHooks.moveActiveIndex,
        }}
      >
        {!searchHooks.hasSearched && (
          <>
            <HeroSection />
            <div className="home-history-card">
              <HistorySection />
            </div>
          </>
        )}

        {searchHooks.selectedItem && (
          <PriceSection
            key={searchHooks.selectedItem.row_id}
            selectedItem={searchHooks.selectedItem}
            priceData={priceHooks.priceData}
            listingsLoading={priceHooks.listingsLoading}
            historyLoading={priceHooks.historyLoading}
            listingsError={priceHooks.listingsError}
            historyError={priceHooks.historyError}
            filteredMannequinCount={priceHooks.filteredMannequinCount}
            fetchPriceData={priceHooks.fetchPriceData}
            fetchPriceHistory={priceHooks.fetchPriceHistory}
            viewTab={searchHooks.viewTab}
            onViewTabChange={searchHooks.setViewTab}
            onWiki={searchHooks.handleWiki}
          />
        )}
      </PageShell>
    </SearchHistoryProvider>
  );
}
