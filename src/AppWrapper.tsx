import { useEffect, useState, useMemo, useCallback } from "react";
import { ConfigProvider, theme } from "antd";
import App from "./App.tsx";
import zhCN from "antd/locale/zh_CN";
import { THEME_KEY } from "./constants.ts";
import type { ThemeMode } from "./constants.ts";

// 从 CSS 变量读取颜色，保持 index.css 为唯一数据源
function cssVar(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** 读取 localStorage 中的主题模式 */
function loadThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch { /* ignore */ }
  return "auto";
}

/** 根据主题模式和系统偏好判断当前是否为深色 */
function computeIsDark(themeMode: ThemeMode, systemDark: boolean): boolean {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return systemDark;
}

const AppWrapper: React.FC = () => {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);

  const isDark = computeIsDark(themeMode, systemDark);

  // 同步 data-theme 到 <html>
  useEffect(() => {
    const attr = themeMode === "auto" ? null : themeMode;
    if (attr) {
      document.documentElement.setAttribute("data-theme", attr);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [themeMode]);

  // 监听系统主题变化
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleThemeModeChange = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
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
      <App
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
      />
    </ConfigProvider>
  );
};

export default AppWrapper;
