import { useState, useCallback, useEffect } from "react";
import { Button, Tooltip, Spin, Alert } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { REGION_KEY, DEFAULT_REGION } from "./constants";
import type { ThemeMode } from "./constants";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { usePriceQuery } from "./hooks/usePriceQuery";
import { useItemSearch } from "./hooks/useItemSearch";
import { useItemDatabase } from "./hooks/useItemDatabase";
import { HeroSection } from "./components/HeroSection";
import { SearchSection } from "./components/SearchSection";
import { HistorySection } from "./components/HistorySection";
import { PriceSection } from "./components/PriceSection";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  loadRecordingEnabled,
  saveRecordingEnabled,
  loadTransactionRecords,
  saveTransactionRecords,
  mergeTransactionRecords,
  cleanExpiredTransactionRecords,
  clearTransactionRecords,
} from "./history";
import type { TransactionStore } from "./types";
import "./App.css";

interface AppProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

function App({ themeMode, onThemeModeChange }: AppProps) {
  const [region, setRegion] = useState(() => localStorage.getItem(REGION_KEY) || DEFAULT_REGION);
  const [recordingEnabled, setRecordingEnabled] = useState(loadRecordingEnabled);
  const [transactionStore, setTransactionStore] = useState<TransactionStore>(() => {
    cleanExpiredTransactionRecords();
    return loadTransactionRecords();
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const itemDb = useItemDatabase();
  const historyHooks = useSearchHistory();
  const priceHooks = usePriceQuery();
  const searchHooks = useItemSearch({
    region,
    fetchPriceData: priceHooks.fetchPriceData,
    addToHistory: historyHooks.addToHistory,
    clearPrice: priceHooks.clearPrice,
    itemDb,
  });

  // 获取到新的价格数据后，保存交易历史到本地（带自动去重）
  useEffect(() => {
    if (!recordingEnabled) return;
    if (!priceHooks.priceData?.recentHistory?.length) return;
    const itemId = priceHooks.priceData.itemID;
    if (itemId == null) return;

    const store = loadTransactionRecords();
    const newStore = mergeTransactionRecords(
      store,
      itemId,
      searchHooks.selectedItem?.fields.Name || `物品 #${itemId}`,
      priceHooks.priceData.recentHistory,
    );
    saveTransactionRecords(newStore);
    setTransactionStore(newStore);
  }, [priceHooks.priceData, recordingEnabled, searchHooks.selectedItem]);

  const handleRecordingToggle = useCallback((enabled: boolean) => {
    setRecordingEnabled(enabled);
    saveRecordingEnabled(enabled);
    if (!enabled) {
      clearTransactionRecords();
      setTransactionStore({});
    }
  }, []);

  const handleFocus = useCallback(() => {
    if (searchHooks.results.length > 0) searchHooks.setShowResults(true);
  }, [searchHooks.results.length, searchHooks.setShowResults]);

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
    <div className={`app-container ${searchHooks.hasSearched ? "searched" : ""}`}>
      {/* 设置入口 — 固定在右上角 */}
      <Tooltip title="设置">
        <Button
          type="text"
          className="settings-trigger"
          icon={<SettingOutlined />}
          onClick={() => setSettingsOpen(true)}
        />
      </Tooltip>

      {!searchHooks.hasSearched && <HeroSection />}

      <SearchSection
        keyword={searchHooks.keyword}
        results={searchHooks.results}
        loading={searchHooks.loading}
        hasSearched={searchHooks.hasSearched}
        showResults={searchHooks.showResults}
        selectedItem={searchHooks.selectedItem}
        onKeywordChange={searchHooks.handleKeywordChange}
        onSearch={searchHooks.doSearch}
        onSelectItem={searchHooks.handleSelectItem}
        onPasteSearch={searchHooks.handlePasteSearch}
        onFocus={handleFocus}
        onCloseResults={() => searchHooks.setShowResults(false)}
      />

      <HistorySection
        sortedHistory={historyHooks.sortedHistory}
        onSearchFromHistory={searchHooks.searchFromHistory}
        onRemoveHistory={historyHooks.removeHistory}
        onClearHistory={historyHooks.clearHistory}
        onTogglePin={historyHooks.togglePin}
      />

      {searchHooks.selectedItem && (
        <PriceSection
          selectedItem={searchHooks.selectedItem}
          region={region}
          onRegionChange={setRegion}
          priceData={priceHooks.priceData}
          priceLoading={priceHooks.priceLoading}
          fetchPriceData={priceHooks.fetchPriceData}
          refreshPrice={priceHooks.refreshPrice}
          viewTab={searchHooks.viewTab}
          onViewTabChange={searchHooks.setViewTab}
          onWiki={searchHooks.handleWiki}
          transactionStore={transactionStore}
        />
      )}

      {/* 设置面板 Drawer */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        onThemeModeChange={onThemeModeChange}
        recordingEnabled={recordingEnabled}
        onRecordingToggle={handleRecordingToggle}
      />
    </div>
  );
}

export default App;

