import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Input,
  Button,
  Typography,
  Spin,
  message,
  Space,
  Card,
  Row,
  Col,
  Table,
  Empty,
  Tooltip,
  Segmented,
  Popconfirm,
} from "antd";
import {
  SearchOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  HistoryOutlined,
  RedoOutlined,
  DeleteOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  PushpinOutlined,
  BarChartOutlined,
  SnippetsOutlined,
} from "@ant-design/icons";
import type { ItemResult, SearchResponse, UniversalisResponse, SearchHistoryItem } from "./types";
import { REGION_MAP, MAX_HISTORY } from "./constants";
import { loadHistory, saveHistory } from "./history";
import { listingColumns, historyColumns } from "./columns";
import "./App.css";

function App() {
  // 搜索
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [viewTab, setViewTab] = useState<string>("listings");

  // 查价
  const [region, setRegion] = useState("中国");
  const [selectedItem, setSelectedItem] = useState<ItemResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceData, setPriceData] = useState<UniversalisResponse | null>(null);
  const priceCache = useRef<Map<string, UniversalisResponse>>(new Map());
  const searchRef = useRef<HTMLDivElement>(null);

  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(loadHistory);

  // 带缓存的查价
  const fetchPriceData = useCallback((itemId: number, regionKey: string) => {
    const cacheKey = `${itemId}-${regionKey}`;
    const cached = priceCache.current.get(cacheKey);
    if (cached) {
      setPriceData(cached);
      return;
    }
    setPriceLoading(true);
    setPriceData(null);
    const regionPath = REGION_MAP[regionKey] || "china";
    fetch(
      `https://universalis.app/api/v2/${regionPath}/${itemId}?listings=50&entries=50`,
    )
      .then((r) => r.json())
      .then((d) => {
        priceCache.current.set(cacheKey, d);
        setPriceData(d);
      })
      .catch(() => message.error("查价失败"))
      .finally(() => setPriceLoading(false));
  }, []);

  // 强制刷新（绕过缓存）
  const refreshPrice = useCallback((itemId: number, regionKey: string) => {
    const cacheKey = `${itemId}-${regionKey}`;
    priceCache.current.delete(cacheKey);
    setPriceLoading(true);
    setPriceData(null);
    const regionPath = REGION_MAP[regionKey] || "china";
    fetch(
      `https://universalis.app/api/v2/${regionPath}/${itemId}?listings=100&entries=100`,
    )
      .then((r) => r.json())
      .then((d) => {
        priceCache.current.set(cacheKey, d);
        setPriceData(d);
      })
      .catch(() => message.error("查价失败"))
      .finally(() => setPriceLoading(false));
  }, []);

  // 点击外部区域收起搜索列表
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- 搜索 ----
  const doSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      message.warning("请输入搜索内容");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setShowResults(true);
    setSelectedItem(null);
    setPriceData(null);
    priceCache.current.clear();
    try {
      const res = await fetch(
        `https://xivapi-v2.xivcdn.com/api/search?query=Name~"${encodeURIComponent(trimmed)}" -IsUntradable=true&sheets=Item&limit=20&fields=Name,Icon`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResponse = await res.json();
      setResults(data.results || []);
    } catch {
      message.error("请求失败，请稍后重试");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 点击搜索结果 → 填入输入框、收起列表、查价
  const handleSelectItem = useCallback((item: ItemResult) => {
    setKeyword(item.fields.Name);
    setShowResults(false);
    setSelectedItem(item);
    setViewTab("listings");
    fetchPriceData(item.row_id, region);
    // 加入历史
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.row_id);
      const next = [{ id: item.row_id, name: item.fields.Name, time: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, [region, fetchPriceData]);

  // 从历史记录搜索
  const searchFromHistory = useCallback((item: SearchHistoryItem) => {
    setKeyword(item.name);
    setHasSearched(true);
    setShowResults(true);
    setSelectedItem(null);
    setPriceData(null);
    priceCache.current.clear();
    setLoading(true);
    fetch(
      `https://xivapi-v2.xivcdn.com/api/search?query=Name~"${encodeURIComponent(item.name)}" -IsUntradable=true&sheets=Item&limit=20&fields=Name,Icon`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SearchResponse) => {
        const list = data.results || [];
        setResults(list);
        const match = list.find((r) => r.row_id === item.id);
        if (match) {
          setSelectedItem(match);
          setShowResults(false);
          fetchPriceData(match.row_id, region);
        }
      })
      .catch(() => {
        message.error("请求失败，请稍后重试");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [region, fetchPriceData]);

  // 删除单条历史
  const removeHistory = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  // 清空历史
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveHistory([]);
  }, []);

  // 固定/取消固定
  const togglePin = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h));
      saveHistory(next);
      return next;
    });
  }, []);

  // 排序后的历史：固定项在前，再按时间倒序
  const sortedHistory = [...searchHistory].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.time - a.time;
  });

  // ---- 行情统计 ----
  // 价格格式化：小数部分不突出显示
  const fmtPrice = (price: number) => {
    const parts = price.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).split(".");
    if (parts.length === 1) {
      return <>{parts[0]}<span className="so-gil"> Gil</span></>;
    }
    return <>{parts[0]}<span className="so-dec">.{parts[1]}</span><span className="so-gil"> Gil</span></>;
  };

  const stats = useMemo(() => {
    const listings = priceData?.listings || [];
    const history = priceData?.recentHistory || [];
    const listingPrices = listings.map((l) => l.pricePerUnit);
    const sortedPrices = [...listingPrices].sort((a, b) => a - b);
    const len = sortedPrices.length;

    const lowestPrice = sortedPrices[0] || 0;
    const avgPrice =
      len > 0 ? listingPrices.reduce((s, p) => s + p, 0) / len : 0;
    const mid = Math.floor(len / 2);
    const medianPrice =
      len > 0
        ? len % 2 === 0
          ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
          : sortedPrices[mid]
        : 0;

    // 成交
    const historyPrices = history.map((h) => h.pricePerUnit);
    const recentAvgPrice =
      historyPrices.length > 0
        ? historyPrices.reduce((s, p) => s + p, 0) / historyPrices.length
        : 0;

    // 10% 截尾平均：去掉首尾各 10% 的极端值后求均值
    const trimCount = len >= 5 ? Math.max(1, Math.floor(len * 0.1)) : 0;
    const trimmedSlice = trimCount > 0 ? sortedPrices.slice(trimCount, len - trimCount) : sortedPrices;
    const trimmedMeanPrice =
      trimmedSlice.length > 0
        ? trimmedSlice.reduce((s, p) => s + p, 0) / trimmedSlice.length
        : avgPrice;

    return {
      lowestPrice,
      avgPrice,
      medianPrice,
      trimmedMeanPrice,
      recentAvgPrice,
      listingCount: len,
      historyCount: history.length,
    };
  }, [priceData]);

  const handleSearch = () => doSearch(keyword);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch(keyword);
  };

  // 粘贴并搜索
  const handlePasteSearch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        message.warning("剪贴板为空");
        return;
      }
      setKeyword(text.trim());
      doSearch(text.trim());
    } catch {
      message.error("读取剪贴板失败，请手动粘贴");
    }
  };

  const handleWiki = (name: string) => {
    window.open(
      `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(name)}`,
      "_blank",
    );
  };



  // ---- 渲染 ----
  return (
    <div className={`app-container ${hasSearched ? "searched" : ""}`}>
      {/* ===== 初始欢迎页 ===== */}
      {!hasSearched && (
        <div className="hero-section">
          <div className="hero-icon">
            <DollarOutlined />
          </div>
          <Typography.Title level={1} className="hero-title">
            FF14 市场查价
          </Typography.Title>
          <Typography.Text className="hero-desc">
            搜索物品，查询全大区市场价格与交易记录
          </Typography.Text>
        </div>
      )}

      {/* ===== 搜索框 ===== */}
      <Card className="search-card" variant="borderless">
        <Space direction="vertical" style={{ width: "100%", maxWidth: 600 }}>
          <div ref={searchRef} style={{ position: "relative" }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                size="large"
                placeholder="输入物品名称"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  if (!e.target.value.trim()) {
                    setShowResults(false);
                    setResults([]);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (results.length > 0) setShowResults(true);
                }}
                prefix={<SearchOutlined />}
                allowClear
                className="search-input"
              />
              <Tooltip title="粘贴并搜索">
                <Button
                  size="large"
                  icon={<SnippetsOutlined />}
                  onClick={handlePasteSearch}
                />
              </Tooltip>
              <Button
                size="large"
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
              >
                搜索
              </Button>
            </Space.Compact>

            {/* 搜索结果 */}
            {hasSearched && showResults && (
              <div className="search-results">
              {loading ? (
                <div className="search-loading"><Spin size="small" /><span>搜索中...</span></div>
              ) : results.length > 0 ? (
                <div className="result-list">
                  {results.map((item) => (
                    <div
                      key={item.row_id}
                      className={`result-item ${selectedItem?.row_id === item.row_id ? "active" : ""}`}
                      onClick={() => handleSelectItem(item)}
                    >
                      <span className="result-name">{item.fields.Name}</span>
                      <span className="result-arrow">↵</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-empty">
                  <Typography.Text type="secondary">未找到相关物品，请尝试其他关键词</Typography.Text>
                </div>
              )}
            </div>
          )}
        </div>
      </Space>
      </Card>

      {/* 搜索历史 */}
      {searchHistory.length > 0 && (
        <div className="search-history">
          <div className="search-history-header">
            <span className="search-history-title">
              <ClockCircleOutlined /> 搜索历史
            </span>
            <Popconfirm
              title="确定清空全部搜索历史？"
              onConfirm={clearHistory}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                className="history-clear-btn"
              >
                清空
              </Button>
            </Popconfirm>
          </div>
          <div className="search-history-list">
            {sortedHistory.map((item) => (
              <div
                key={item.id}
                className={`search-history-item${item.pinned ? " pinned" : ""}`}
                onClick={() => searchFromHistory(item)}
              >
                <span className="search-history-name">{item.name}</span>
                <Tooltip title={item.pinned ? "取消固定" : "固定到最前"}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PushpinOutlined />}
                    onClick={(e) => togglePin(item.id, e)}
                    className="history-pin-btn"
                  />
                </Tooltip>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => removeHistory(item.id, e)}
                  className="history-del-btn"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 查价结果 ===== */}
      {selectedItem && (
        <div className="price-area">
          {/* 物品名称 + 大区 */}
          <div className="price-header">
            <div
              className="item-name-clickable"
              onClick={() => handleWiki(selectedItem.fields.Name)}
              title="点击查看 WIKI"
            >
              <Typography.Title level={3} style={{ margin: 0 }}>
                {selectedItem.fields.Name}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                ID: {selectedItem.row_id}
              </Typography.Text>
            </div>
            <Segmented
              value={region}
              onChange={(v) => {
                const val = v as string;
                setRegion(val);
                if (selectedItem) {
                  fetchPriceData(selectedItem.row_id, val);
                }
              }}
              options={[
                { label: <>中国</>, value: "中国" },
                { label: <>陆行鸟</>, value: "陆行鸟" },
                { label: <>莫古力</>, value: "莫古力" },
                { label: <>猫小胖</>, value: "猫小胖" },
                { label: <>豆豆柴</>, value: "豆豆柴" },
              ]}
              className="region-segmented"
            />
          </div>

          <Spin spinning={priceLoading}>
            {priceData ? (
              <>

                {/* 移动端：Segmented 切换 */}
                <div className="view-tab-bar">
                  <Segmented
                    value={viewTab}
                    onChange={(v) => setViewTab(v as string)}
                    options={[
                      { label: <><ShoppingCartOutlined /> 出售列表</>, value: "listings" },
                      { label: <><HistoryOutlined /> 交易历史</>, value: "history" },
                    ]}
                    block
                  />
                </div>

                {/* 桌面端：双列 */}
                <Row gutter={[16, 16]} className="data-row-desktop">
                  <Col xs={24} lg={12}>
                    <Card
                      title={<><ShoppingCartOutlined /> 出售列表</>}
                      size="small"
                      className="data-card"
                      extra={
                        <Tooltip title="刷新价格">
                          <Button
                            type="text"
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={() => refreshPrice(selectedItem.row_id, region)}
                            loading={priceLoading}
                          />
                        </Tooltip>
                      }
                    >
                      {priceData.listings?.length ? (
                        <Table
                          dataSource={priceData.listings}
                          columns={listingColumns}
                          rowKey={(_, i) => String(i)}
                          size="small"
                          pagination={{ pageSize: 15, showSizeChanger: false }}
                          scroll={{ x: 450 }}
                          rowClassName={(_, index) => index < 3 ? 'top-three-row' : ''}
                        />
                      ) : (
                        <Empty description="暂无出售数据" />
                      )}
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card
                      title={<><HistoryOutlined /> 交易历史</>}
                      size="small"
                      className="data-card"
                      extra={null}
                    >
                      {priceData.recentHistory?.length ? (
                        <Table
                          dataSource={priceData.recentHistory}
                          columns={historyColumns}
                          rowKey={(_, i) => String(i)}
                          size="small"
                          pagination={{ pageSize: 15, showSizeChanger: false }}
                          scroll={{ x: 550 }}
                        />
                      ) : (
                        <Empty description="暂无交易记录" />
                      )}
                    </Card>
                  </Col>
                </Row>

                {/* 移动端：单列切换 */}
                <div className="data-row-mobile">
                  {viewTab === "listings" && (
                    <Card
                      title={<><ShoppingCartOutlined /> 出售列表</>}
                      size="small"
                      className="data-card"
                      extra={
                        <Tooltip title="刷新价格">
                          <Button
                            type="text"
                            size="small"
                            icon={<DollarOutlined />}
                            onClick={() => refreshPrice(selectedItem.row_id, region)}
                            loading={priceLoading}
                          />
                        </Tooltip>
                      }
                    >
                      {priceData.listings?.length ? (
                        <Table
                          dataSource={priceData.listings}
                          columns={listingColumns}
                          rowKey={(_, i) => String(i)}
                          size="small"
                          pagination={{ pageSize: 15, showSizeChanger: false }}
                          scroll={{ x: 450 }}
                          rowClassName={(_, index) => index < 3 ? 'top-three-row' : ''}
                        />
                      ) : (
                        <Empty description="暂无出售数据" />
                      )}
                    </Card>
                  )}
                  {viewTab === "history" && (
                    <Card
                      title={<><HistoryOutlined /> 交易历史</>}
                      size="small"
                      className="data-card"
                    >
                      {priceData.recentHistory?.length ? (
                        <Table
                          dataSource={priceData.recentHistory}
                          columns={historyColumns}
                          rowKey={(_, i) => String(i)}
                          size="small"
                          pagination={{ pageSize: 15, showSizeChanger: false }}
                          scroll={{ x: 550 }}
                        />
                      ) : (
                        <Empty description="暂无交易记录" />
                      )}
                    </Card>
                  )}
                </div>

                {/* ===== 行情概览 ===== */}
                {stats.listingCount > 0 && (
                  <Card
                    title={<><BarChartOutlined /> 行情概览</>}
                    size="small"
                    className="stats-overview-card"
                  >
                    <Row gutter={[16, 12]}>
                      <Col xs={12} sm={8} md={6}>
                        <div className="so-item">
                          <div className="so-label">最低单价</div>
                          <div className="so-value so-low">
                            {fmtPrice(stats.lowestPrice)}
                          </div>
                        </div>
                      </Col>
                      <Col xs={12} sm={8} md={6}>
                        <Tooltip title={`原始均价：${stats.avgPrice.toLocaleString()} Gil（含极端值）`}>
                          <div className="so-item">
                            <div className="so-label">
                              截尾均价
                              <span className="so-label-hint"> 10%</span>
                            </div>
                            <div className="so-value">
                              {fmtPrice(stats.trimmedMeanPrice)}
                            </div>
                          </div>
                        </Tooltip>
                      </Col>
                      <Col xs={12} sm={8} md={6}>
                        <div className="so-item">
                          <div className="so-label">中位数单价</div>
                          <div className="so-value">
                            {fmtPrice(stats.medianPrice)}
                          </div>
                        </div>
                      </Col>
                      <Col xs={12} sm={8} md={6}>
                        <div className="so-item">
                          <div className="so-label">近期成交均价</div>
                          <div className="so-value">
                            {stats.recentAvgPrice > 0 ? (
                              fmtPrice(stats.recentAvgPrice)
                            ) : (
                              <span className="so-na">暂无</span>
                            )}
                          </div>
                        </div>
                      </Col>
                    </Row>

                  </Card>
                )}
              </>
            ) : (
              !priceLoading && <Empty description="暂无数据" />
            )}
          </Spin>
        </div>
      )}
    </div>
  );
}

export default App;
