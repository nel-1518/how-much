import { useCallback } from "react";
import { Drawer, Segmented, Switch, Space, Typography, Divider, Tooltip, Modal } from "antd";
import {
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
  LaptopOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ThemeMode } from "../constants";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  recordingEnabled: boolean;
  onRecordingToggle: (enabled: boolean) => void;
}

/** 设置面板 — 以 Drawer 形式从右侧滑出 */
export function SettingsPanel({
  open,
  onClose,
  themeMode,
  onThemeModeChange,
  recordingEnabled,
  onRecordingToggle,
}: SettingsPanelProps) {
  const handleThemeChange = useCallback(
    (val: string | number) => onThemeModeChange(val as ThemeMode),
    [onThemeModeChange],
  );

  const handleRecordingChange = useCallback(
    (checked: boolean) => {
      // 开启时直接通过
      if (checked) {
        onRecordingToggle(true);
        return;
      }
      // 关闭时弹出确认
      Modal.confirm({
        title: "关闭自动记录",
        icon: <ExclamationCircleOutlined />,
        content: "关闭后将清空所有已保存的交易记录，确定要继续吗？",
        okText: "确定关闭",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => onRecordingToggle(false),
      });
    },
    [onRecordingToggle],
  );

  return (
    <Drawer
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          设置
        </span>
      }
      placement="right"
      width={340}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: "20px 24px" } }}
    >
      {/* ---- 显示设置 ---- */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        <MoonOutlined style={{ marginRight: 6 }} />
        显示
      </Typography.Title>

      <div className="settings-row">
        <Space direction="vertical" style={{ width: "100%" }} size={4}>
          <Typography.Text strong>深色模式</Typography.Text>
          <Segmented
            value={themeMode}
            onChange={handleThemeChange}
            style={{ width: "100%" }}
            options={[
              { label: <span><LaptopOutlined /> 跟随系统</span>, value: "auto" },
              { label: <span><SunOutlined /> 浅色</span>, value: "light" },
              { label: <span><MoonOutlined /> 深色</span>, value: "dark" },
            ]}
          />
        </Space>
      </div>

      <Divider style={{ margin: "20px 0" }} />

      {/* ---- 交易记录 ---- */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        <SaveOutlined style={{ marginRight: 6 }} />
        交易记录
      </Typography.Title>

      <div className="settings-row">
        <div className="settings-row-inline">
          <Space direction="vertical" size={2}>
            <Typography.Text strong>自动记录</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              关闭后将清空所有交易记录
            </Typography.Text>
          </Space>
          <Tooltip title={recordingEnabled ? "关闭后将清空所有交易记录" : "开启后自动保存交易记录"}>
            <Switch
              checked={recordingEnabled}
              onChange={handleRecordingChange}
            />
          </Tooltip>
        </div>
      </div>
    </Drawer>
  );
}
