import { useState, useCallback, useEffect, useRef, type ComponentRef } from "react";
import { flushSync } from "react-dom";
import { Button, Spin, Alert, type Input } from "antd";
import type { ThemeMode } from "./constants";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { usePriceQuery } from "./hooks/usePriceQuery";
import { useItemSearch } from "./hooks/useItemSearch";
import { useItemDatabase } from "./hooks/useItemDatabase";
import { useRegionScope } from "./hooks/useRegionScope";
import { HeroSection } from "./components/HeroSection";
import { TopNav } from "./components/TopNav";
import { SearchCard } from "./components/SearchCard";
import { HistorySection } from "./components/HistorySection";
import { HistorySidebar } from "./components/HistorySidebar";
import { PriceSection } from "./components/PriceSection";
import { SettingsDialog } from "./components/SettingsDialog";
import { InfoDialog } from "./components/InfoDialog";
import {
  loadSidebarOpen,
  saveSidebarOpen,
  loadSidebarWidth,
  saveSidebarWidth,
} from "./history";
import "./App.css";

interface AppProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  /** 当前是否为深色（auto 模式下由系统偏好决定） */
  isDark: boolean;
}

function App({ themeMode, onThemeModeChange, isDark }: AppProps) {
  const { scope, dcServer, setScope, selectServer } = useRegionScope();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // 侧栏初始状态：移动端默认关闭（不继承桌面端记忆）；桌面端记住上次开关状态
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches)
      ? false
      : loadSidebarOpen(),
  );
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
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

  // 键盘打开卡片时的状态：待补入的首字符、IME 组合中标记、顶部输入框引用
  const pendingKeyRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const topInputRef = useRef<ComponentRef<typeof Input> | null>(null);

  const closeSearchCard = useCallback(() => {
    setShowResults(false);
  }, [setShowResults]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      // 移动端不持久化（每次进入默认关闭）；桌面端记住开关状态
      if (!window.matchMedia("(max-width: 768px)").matches) {
        saveSidebarOpen(next);
      }
      return next;
    });
  }, []);

  const handleSidebarResize = useCallback((w: number) => {
    setSidebarWidth(w);
  }, []);

  const handleSidebarResizeEnd = useCallback((w: number) => {
    saveSidebarWidth(w);
    setSidebarResizing(false);
  }, []);

  /** 顶部输入框内容变化：按输入方式打开卡片（不自动聚焦卡片输入框） */
  const handleTopKeywordChange = useCallback((v: string) => {
    setFocusCardOnOpen(false);
    handleKeywordChange(v);
  }, [handleKeywordChange]);

  // 记录卡片开合状态，供全局键盘监听使用（避免闭包过期）
  const showResultsRef = useRef(searchHooks.showResults);
  useEffect(() => {
    showResultsRef.current = searchHooks.showResults;
  }, [searchHooks.showResults]);

  // 全局键盘：Esc 关闭卡片；Tab 开关卡片；字母/数字或 IME 首个按键打开卡片并聚焦输入框；
  // Ctrl+V 粘贴直接打开并置入输入栏
  useEffect(() => {
    const openAndFocusCard = () => {
      // 同步渲染卡片并聚焦顶部输入框，让当前按键的默认行为
      // （拉丁字符插入 / IME 组合输入）直接落到已聚焦的输入框上
      setFocusCardOnOpen(false);
      flushSync(() => {
        setActiveIndex(0);
        setShowResults(true);
      });
      topInputRef.current?.focus();
    };

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showResultsRef.current) {
          e.preventDefault();
          closeSearchCard();
        }
        return;
      }
      if (settingsOpen || infoOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // `：打开 / 关闭历史侧栏（输入框内不拦截，避免影响正常输入）
      if (e.key === "`") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
        e.preventDefault();
        handleToggleSidebar();
        return;
      }

      // Tab：卡片打开时关闭；关闭时打开并聚焦卡片内输入框
      // 顶部输入框已有内容时保留内容（显示对应搜索结果）并全选，空内容时显示历史
      if (e.key === "Tab") {
        if (showResultsRef.current) {
          e.preventDefault();
          closeSearchCard();
          return;
        }
        e.preventDefault();
        setFocusCardOnOpen(true);
        setActiveIndex(0);
        const current = topInputRef.current?.input?.value ?? "";
        handleKeywordChange(current);
        return;
      }

      if (showResultsRef.current) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.isComposing) return;

      // IME 组合首键（keyCode 229 / key "Process"）：只打开并聚焦，不插入、不阻止默认行为
      if (e.keyCode === 229 || e.key === "Process") {
        pendingKeyRef.current = null;
        openAndFocusCard();
        return;
      }

      // 字母/数字：不阻止默认行为，让字符直接进入输入框
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        pendingKeyRef.current = e.key;
        openAndFocusCard();
      }
    };

    const handleCompositionStart = (e: CompositionEvent) => {
      composingRef.current = true;
      // 组合若发生在输入框内（顶部或卡片内），不干预焦点；
      // 仅在组合落在非输入框元素上（页面空白处打字唤起卡片的兜底场景）时聚焦顶部输入框
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (showResultsRef.current) {
        topInputRef.current?.focus();
      }
    };
    const handleCompositionEnd = () => {
      composingRef.current = false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (showResultsRef.current || settingsOpen) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      // 只接管页面空白处或顶部搜索输入框内的粘贴，其余输入控件保持原生粘贴
      if (inEditable && !target?.closest(".search-trigger-input")) return;
      const text = (e.clipboardData?.getData("text") ?? "").replace(/\s+/g, " ").trim();
      if (!text) return;
      e.preventDefault();

      // 粘贴内容唯一精确匹配到物品时，直接查价
      const exact = findExactName(text);
      if (exact) {
        selectByDbEntry(exact);
        return;
      }

      handleKeywordChange(text);
      setFocusCardOnOpen(false);
      topInputRef.current?.focus();
    };

    document.addEventListener("keydown", handler);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("compositionstart", handleCompositionStart);
    document.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("compositionstart", handleCompositionStart);
      document.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [settingsOpen, infoOpen, closeSearchCard, handleToggleSidebar, handleKeywordChange, setActiveIndex, setShowResults, setFocusCardOnOpen, findExactName, selectByDbEntry]);

  // 键盘打开卡片后，若首个字符没有进入输入框（浏览器未把默认行为重定向到输入框），手动补入
  useEffect(() => {
    const key = pendingKeyRef.current;
    if (key == null) return;
    pendingKeyRef.current = null;
    const timer = window.setTimeout(() => {
      if (composingRef.current) return;
      const el = topInputRef.current?.input;
      if (!el || el.value !== key) {
        handleKeywordChange(key);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchHooks.showResults, handleKeywordChange]);

  // 物品数据库加载中
  if (itemDb.status === "loading") {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" tip="正在加载物品数据库…" />
      </div>
    );
  }

  // 物品数据库加载失败
  if (itemDb.status === "error") {
    return (
      <div className="app-container" style={{ padding: 48 }}>
        <Alert
          message="加载失败"
          description={itemDb.errorMsg}
          type="error"
          showIcon
          action={<Button onClick={() => window.location.reload()}>刷新页面</Button>}
        />
      </div>
    );
  }

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
          inputRef: topInputRef,
          onKeywordChange: handleTopKeywordChange,
          onSearch: searchHooks.doSearch,
          onSelectItem: searchHooks.handleSelectItem,
          onMoveActive: searchHooks.moveActiveIndex,
        }}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        themeMode={themeMode}
        isDark={isDark}
        onThemeChange={onThemeModeChange}
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
          focusOnMount={focusCardOnOpen}
          onKeywordChange={searchHooks.handleKeywordChange}
          onSearch={searchHooks.doSearch}
          onSelectItem={searchHooks.handleSelectItem}
          onMoveActive={searchHooks.moveActiveIndex}
          onActivate={searchHooks.setActiveIndex}
          onClose={closeSearchCard}
        />
      )}

      <div className={`app-container ${searchHooks.hasSearched ? "searched" : ""}`}>
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
            scope={scope}
            dcServer={dcServer}
            onScopeChange={setScope}
            onSelectServer={selectServer}
            priceData={priceHooks.priceData}
            priceLoading={priceHooks.priceLoading}
            fetchPriceData={priceHooks.fetchPriceData}
            refreshPrice={priceHooks.refreshPrice}
            viewTab={searchHooks.viewTab}
            onViewTabChange={searchHooks.setViewTab}
            onWiki={searchHooks.handleWiki}
            isDark={isDark}
          />
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

