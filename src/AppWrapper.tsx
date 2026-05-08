import { useEffect, useState, useMemo } from "react";
import { ConfigProvider, theme } from "antd";
import App from "./App.tsx";
import zhCN from "antd/locale/zh_CN";

// 从 CSS 变量读取颜色，保持 index.css 为唯一数据源
function cssVar(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const AppWrapper: React.FC = () => {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 读取 CSS 变量（数据源：index.css），暗色/亮色自动跟随
  const token = useMemo(() => ({
    colorPrimary: cssVar("--accent", "#8b5cf6"),
    colorSuccess: cssVar("--ant-color-success", "#22c55e"),
    colorWarning: cssVar("--ant-color-warning", "#f59e0b"),
    colorError: cssVar("--ant-color-error", "#ef4444"),
    colorInfo: cssVar("--ant-color-info", "#3b82f6"),
    colorText: cssVar("--text", "#4a4458"),
    colorBgContainer: cssVar("--bg-card", "#ffffff"),
    colorBorder: cssVar("--border", "#e8e4dd"),
    boxShadow: cssVar("--ant-box-shadow", "0 4px 16px rgba(0,0,0,0.06)"),
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    controlHeight: 38,
  }), []);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token,
      }}
    >
      <App />
    </ConfigProvider>
  );
};

export default AppWrapper;
