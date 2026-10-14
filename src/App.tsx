import { useState, useCallback, useRef, type ComponentRef } from "react";
import { Button, Alert, type Input } from "antd";
import type { BatchItem, ViewMode } from "./types";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { usePriceQuery } from "./hooks/usePriceQuery";
import { useItemSearch } from "./hooks/useItemSearch";
import { useItemDatabase } from "./hooks/useItemDatabase";
import { useUrlQueryOpen } from "./hooks/useUrlQueryOpen";
import { useGlobalSearchHotkeys } from "./hooks/useGlobalSearchHotkeys";
import { HeroSection } from "./components/HeroSection";
import { TopNav } from "./components/TopNav";
import { SearchCard } from "./components/SearchCard";
import { HistorySection } from "./components/HistorySection";
import { HistorySidebar } from "./components/HistorySidebar";
import { PriceSection } from "./components/PriceSection";
import { BatchPriceSection } from "./components/BatchPriceSection";
import { SettingsDialog } from "./components/SettingsDialog";
import { InfoDialog } from "./components/InfoDialog";
import { useRegionScopeContext } from "./contexts/RegionScopeContext";
import { storage } from "./storage";
import "./App.css";

function App() {
  const { scope, setScope, selectServer } = useRegionScopeContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  // 侧栏初始状态：移动端默认关闭（不继承桌面端记忆）；桌面端记住上次开关状态
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches)
      ? false
      : storage.sidebar.load().open,
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => storage.sidebar.load().width);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  // 是否由 Tab 打开卡片（决定卡片输入框是否自动聚焦）
  const [focusCardOnOpen, setFocusCardOnOpen] = useState(false);

  const itemDb = useItemDatabase();
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

  /** 模式切换：切到批量时关闭悬浮搜索卡片 */
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "batch") setShowResults(false);
  }, [setShowResults]);

  /** 批量查价结果中打开单个详情：切回单个模式并按本地库条目查价 */
  const handleOpenSingleItem = useCallback((item: BatchItem) => {
    setViewMode("single");
    selectByDbEntry({ id: item.id, name: item.name, hq: item.canBeHq ? 1 : 0 });
  }, [selectByDbEntry]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      // 移动端不持久化（每次进入默认关闭）；桌面端记住开关状态
      if (!window.matchMedia("(max-width: 768px)").matches) {
        storage.sidebar.setOpen(next);
      }
      return next;
    });
  }, []);

  const handleSidebarResize = useCallback((w: number) => {
    setSidebarWidth(w);
  }, []);

  const handleSidebarResizeEnd = useCallback((w: number) => {
    storage.sidebar.setWidth(w);
    setSidebarResizing(false);
  }, []);

  /** 顶部输入框内容变化：按输入方式打开卡片（不自动聚焦卡片输入框） */
  const handleTopKeywordChange = useCallback((v: string) => {
    setFocusCardOnOpen(false);
    handleKeywordChange(v);
  }, [handleKeywordChange]);

  // 全局键盘与粘贴快捷键（Esc / Tab / 字母唤起 / IME 组合 / 粘贴接管）
  useGlobalSearchHotkeys({
    showResults: searchHooks.showResults,
    viewMode,
    settingsOpen,
    infoOpen,
    topInputRef,
    closeSearchCard,
    onToggleSidebar: handleToggleSidebar,
    setFocusCardOnOpen,
    onKeywordChange: handleKeywordChange,
    setActiveIndex,
    setShowResults,
    findExactName,
    selectByDbEntry,
  });

  // 物品数据库不再阻塞首屏：加载中直接渲染页面（搜索在数据库就绪前提示"加载中"）；
  // 加载失败时在内容区顶部显示错误提示，页面其余功能不受影响
  return (
    <div
      className={`app-shell${sidebarOpen ? " sidebar-open" : ""}${sidebarResizing ? " resizing" : ""}`}
      style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <TopNav
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
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <HistorySidebar
        open={sidebarOpen}
        width={sidebarWidth}
        sortedHistory={historyHooks.sortedHistory}
        activeItemId={searchHooks.selectedItem?.row_id ?? null}
        onSearchFromHistory={searchHooks.searchFromHistory}
        onRemoveHistory={historyHooks.removeHistory}
        onClearHistory={historyHooks.clearHistory}
        onTogglePin={historyHooks.togglePin}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenInfo={() => setInfoOpen(true)}
        onResizeStart={() => setSidebarResizing(true)}
        onResize={handleSidebarResize}
        onResizeEnd={handleSidebarResizeEnd}
      />

      {/* 居中悬浮搜索卡片 */}
      {searchHooks.showResults && (
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
      )}

      <div className={`app-container${searchHooks.hasSearched || viewMode === "batch" ? " searched" : ""}${viewMode === "batch" ? " batch-mode" : ""}`}>
        {itemDb.status === "error" && (
          <Alert
            message="物品数据库加载失败"
            description={itemDb.errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 16, width: "100%", maxWidth: 800 }}
            action={<Button size="small" onClick={() => window.location.reload()}>刷新页面</Button>}
          />
        )}
        {viewMode === "batch" ? (
          <BatchPriceSection
            itemDb={itemDb}
            onOpenSingleItem={handleOpenSingleItem}
          />
        ) : (
          <>
            {!searchHooks.hasSearched && (
              <>
                <HeroSection />
                <div className="home-history-card">
                  <HistorySection
                    sortedHistory={historyHooks.sortedHistory}
                    onSearchFromHistory={searchHooks.searchFromHistory}
                    onRemoveHistory={historyHooks.removeHistory}
                    onClearHistory={historyHooks.clearHistory}
                    onTogglePin={historyHooks.togglePin}
                  />
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
          </>
        )}

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        <InfoDialog
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          itemDbVersion={itemDb.version}
        />
      </div>
    </div>
  );
}

export default App;

