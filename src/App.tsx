import { useState, useCallback, useEffect } from "react";
import { REGION_KEY, DEFAULT_REGION } from "./constants";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { usePriceQuery } from "./hooks/usePriceQuery";
import { useItemSearch } from "./hooks/useItemSearch";
import { HeroSection } from "./components/HeroSection";
import { SearchSection } from "./components/SearchSection";
import { HistorySection } from "./components/HistorySection";
import { PriceSection } from "./components/PriceSection";
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

function App() {
  const [region, setRegion] = useState(() => localStorage.getItem(REGION_KEY) || DEFAULT_REGION);
  const [recordingEnabled, setRecordingEnabled] = useState(loadRecordingEnabled);
  const [transactionStore, setTransactionStore] = useState<TransactionStore>(() => {
    cleanExpiredTransactionRecords();
    return loadTransactionRecords();
  });

  const historyHooks = useSearchHistory();
  const priceHooks = usePriceQuery();
  const searchHooks = useItemSearch({
    region,
    fetchPriceData: priceHooks.fetchPriceData,
    addToHistory: historyHooks.addToHistory,
    clearPrice: priceHooks.clearPrice,
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

  return (
    <div className={`app-container ${searchHooks.hasSearched ? "searched" : ""}`}>
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
        recordingEnabled={recordingEnabled}
        onRecordingToggle={handleRecordingToggle}
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
          isPureIdSearch={searchHooks.isPureIdSearch}
          transactionStore={transactionStore}
        />
      )}
    </div>
  );
}

export default App;

