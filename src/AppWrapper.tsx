import { useEffect, useState } from "react";
import { ConfigProvider, theme } from "antd";
import App from "./App.tsx";
import zhCN from 'antd/locale/zh_CN';

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

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token: {
          colorPrimary: "#8b5cf6",
          colorSuccess: "#22c55e",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorInfo: "#3b82f6",
          borderRadius: 10,
          borderRadiusLG: 14,
          borderRadiusSM: 8,
          fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 15,
          colorText: isDark ? "#b0aeb8" : "#4a4458",
          colorBgContainer: isDark ? "#1c1a22" : "#ffffff",
          colorBorder: isDark ? "#2d2a35" : "#e8e4dd",
          boxShadow:
            "0 4px 16px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)",
          controlHeight: 38,
        },
      }}
    >
      <App />
    </ConfigProvider>
  );
};

export default AppWrapper;
