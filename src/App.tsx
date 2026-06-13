import { useState, useCallback } from "react";
import { REGION_KEY, DEFAULT_REGION } from "./constants";
import { useSearchHistory } from "./hooks/useSearchHistory";
import { usePriceQuery } from "./hooks/usePriceQuery";
import { useItemSearch } from "./hooks/useItemSearch";
import { HeroSection } from "./components/HeroSection";
import { SearchSection } from "./components/SearchSection";
import { HistorySection } from "./components/HistorySection";
import { PriceSection } from "./components/PriceSection";
import "./App.css";

function App() {
  const [region, setRegion] = useState(() => localStorage.getItem(REGION_KEY) || DEFAULT_REGION);

  const historyHooks = useSearchHistory();
  const priceHooks = usePriceQuery();
  const searchHooks = useItemSearch({
    region,
    fetchPriceData: priceHooks.fetchPriceData,
    addToHistory: historyHooks.addToHistory,
    clearPrice: priceHooks.clearPrice,
  });

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
        />
      )}
    </div>
  );
}

export default App;

