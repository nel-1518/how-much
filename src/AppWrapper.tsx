import { useEffect, useState, useMemo, useCallback } from "react";
import { ConfigProvider, theme } from "antd";
import App from "./App.tsx";
import zhCN from "antd/locale/zh_CN";
import { THEME_KEY } from "./constants.ts";
import type { ThemeMode } from "./constants.ts";

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

  // 直接根据 isDark 计算 Ant Design token，避免 useMemo 在渲染阶段
  // 读取 DOM CSS 变量时的时机问题（此时 data-theme 尚未更新）
  const token = useMemo(() => ({
    colorPrimary: isDark ? "#a78bfa" : "#8b5cf6",
    colorSuccess: isDark ? "#4ade80" : "#22c55e",
    colorWarning: isDark ? "#fbbf24" : "#f59e0b",
    colorError: isDark ? "#f87171" : "#ef4444",
    colorInfo: isDark ? "#60a5fa" : "#3b82f6",
    colorText: isDark ? "#b0aeb8" : "#4a4458",
    colorBgContainer: isDark ? "#1c1a22" : "#ffffff",
    colorBorder: isDark ? "#2d2a35" : "#e8e4dd",
    boxShadow: isDark
      ? "0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2)"
      : "0 4px 16px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)",
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    controlHeight: 38,
  }), [isDark]);

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
        isDark={isDark}
      />
    </ConfigProvider>
  );
};

export default AppWrapper;
