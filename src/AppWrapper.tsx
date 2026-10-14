import { ConfigProvider, theme } from "antd";
import App from "./App.tsx";
import zhCN from "antd/locale/zh_CN";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext.tsx";
import { RegionScopeProvider } from "./contexts/RegionScopeContext.tsx";

/** 读取主题上下文并配置 Ant Design（ConfigProvider 依赖主题值，故置于 Provider 之内） */
function ThemedApp() {
  const { isDark, tokens } = useTheme();
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token: tokens,
      }}
    >
      <App />
    </ConfigProvider>
  );
}

const AppWrapper: React.FC = () => (
  <ThemeProvider>
    <RegionScopeProvider>
      <ThemedApp />
    </RegionScopeProvider>
  </ThemeProvider>
);

export default AppWrapper;
