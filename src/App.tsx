import { Routes, Route, Navigate } from "react-router";
import { HomePage } from "./pages/HomePage";
import { BatchPage } from "./pages/BatchPage";
import "./App.css";

/**
 * 路由入口：
 * - `/`      主页（单个查价）
 * - `/batch` 批量查价（可带 # 直接访问，如 #/batch）
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/batch" element={<BatchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
