import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemeConfig } from "antd";
import { storage } from "../storage";
import type { ThemeMode } from "../constants";

/** Ant Design 主题 token */
export type ThemeTokens = ThemeConfig["token"];

/** 图表配色（随深浅主题切换；price/trend 与 antd 主色 / 警告色保持一致） */
export interface ChartPalette {
  /** 平均价主线（紫） */
  price: string;
  /** 趋势线（橙） */
  trend: string;
  /** 最高/最低价区间线 */
  range: string;
  /** 区间带填充 */
  rangeFill: string;
  /** 网格线 */
  grid: string;
  /** 坐标轴文字 */
  text: string;
}

export interface ThemeValue {
  themeMode: ThemeMode;
  isDark: boolean;
  /** antd 主题 token */
  tokens: ThemeTokens;
  /** 图表配色 */
  chart: ChartPalette;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** 根据主题模式和系统偏好判断当前是否为深色 */
function computeIsDark(themeMode: ThemeMode, systemDark: boolean): boolean {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return systemDark;
}

/**
 * 主题状态与色板 Provider。集中持有主题模式 / 系统偏好监听 / antd token / 图表配色，
 * 供 ConfigProvider（antd）与深层组件（如图表）共同消费，消除 `isDark` 的逐层传递。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => storage.theme.load());

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

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    storage.theme.save(mode);
  }, []);

  // 直接根据 isDark 计算 Ant Design token，避免在渲染阶段读取 DOM CSS 变量的时机问题
  const tokens = useMemo<ThemeTokens>(
    () => ({
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
    }),
    [isDark],
  );

  const chart = useMemo<ChartPalette>(
    () => ({
      price: isDark ? "#a78bfa" : "#8b5cf6",
      trend: isDark ? "#fbbf24" : "#f59e0b",
      range: isDark ? "rgba(176,174,184,0.25)" : "rgba(120,113,127,0.2)",
      rangeFill: isDark ? "rgba(176,174,184,0.08)" : "rgba(120,113,127,0.07)",
      grid: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      text: isDark ? "#b0aeb8" : "#78717f",
    }),
    [isDark],
  );

  const value = useMemo<ThemeValue>(
    () => ({ themeMode, isDark, tokens, chart, setThemeMode }),
    [themeMode, isDark, tokens, chart, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取主题状态与色板 */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}
