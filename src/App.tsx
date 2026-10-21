import { Routes, Route, Navigate } from "react-router";
import { HomePage } from "./pages/HomePage";
import { BatchPage } from "./pages/BatchPage";
import { MARKET_PATH } from "./constants";
import "./App.css";

/**
 * 路由入口：
 * - `/market`                     单个查价（首页状态）
 * - `/market/:id`                 单个查价（指定物品，如 #/market/36179）
 * - `/market/:id/:worldId`        单个查价（指定物品与区服，如 #/market/36179/1167）
 * - `/batch`                      批量查价（可带 # 直接访问，如 #/batch）
 * - `/` 及其余路径统一重定向到单个查价页
 *
 * 单个查价的三种地址挂在同一个父路由下：页面组件在切换物品 / 区服时保持挂载，
 * 搜索状态与查价缓存不会因地址变化而丢失（参数由 useItemUrlSync 从 pathname 解析）。
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={MARKET_PATH} replace />} />
      <Route path={MARKET_PATH} element={<HomePage />}>
        <Route index element={null} />
        <Route path=":id" element={null} />
        <Route path=":id/:worldId" element={null} />
      </Route>
      <Route path="/batch" element={<BatchPage />} />
      <Route path="*" element={<Navigate to={MARKET_PATH} replace />} />
    </Routes>
  );
}

export default App;
