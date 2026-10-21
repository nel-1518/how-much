import { useState, type ReactNode } from "react";
import { Modal, Space, Typography, Segmented } from "antd";
import {
  SettingOutlined,
  NumberOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import type { PriceFormat, ThemeMode } from "../constants";
import { storage } from "../storage";
import { useTheme } from "../contexts/ThemeContext";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const PRICE_FORMAT_OPTIONS: { label: string; value: PriceFormat; example: string }[] = [
  { label: "千分位", value: "comma", example: "1,234,567" },
  { label: "四位空格", value: "space4", example: "123 4567" },
];

/** 主题模式选项 */
const THEME_OPTIONS: { label: ReactNode; value: ThemeMode }[] = [
  { label: <span>跟随系统</span>, value: "auto" },
  { label: <span>浅色</span>, value: "light" },
  { label: <span>深色</span>, value: "dark" },
];

/** 设置弹窗：主题模式 + 金额显示格式 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  // 主题：直接读写全局主题上下文，切换即时生效并持久化
  const { themeMode, setThemeMode } = useTheme();
  // 金额格式：弹窗内部自管（打开时读本地存储，选择即保存；页面重载后生效）
  const [priceFormat, setPriceFormat] = useState<PriceFormat>(() => storage.priceFormat.load());

  return (
    <Modal
      title={<span><SettingOutlined style={{ marginRight: 8 }} />设置</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={380}
      styles={{ body: { padding: "20px 24px" } }}
    >
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        <BgColorsOutlined style={{ marginRight: 6 }} />
        主题
      </Typography.Title>
      <div className="settings-row">
        <div className="settings-row-inline">
        </div>
      </div>
      <Segmented<ThemeMode>
        block
        value={themeMode}
        onChange={setThemeMode}
        options={THEME_OPTIONS}
      />

      <Typography.Title level={5} style={{ margin: "24px 0 12px" }}>
        <NumberOutlined style={{ marginRight: 6 }} />
        金额显示格式
      </Typography.Title>
      <div className="settings-row">
        <div className="settings-row-inline">
          <Space orientation="vertical" size={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              应用于全部价格显示，刷新后生效
            </Typography.Text>
          </Space>
        </div>
      </div>
      <Segmented<PriceFormat>
        block
        value={priceFormat}
        onChange={(v) => {
          setPriceFormat(v);
          storage.priceFormat.save(v);
        }}
        options={PRICE_FORMAT_OPTIONS.map((o) => ({
          label: (
            <div style={{ textAlign: "center", padding: "2px 0" }}>
              <div style={{ fontSize: 13 }}>{o.label}</div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>{o.example}</div>
            </div>
          ),
          value: o.value,
        }))}
      />
    </Modal>
  );
}
