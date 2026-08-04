import { useCallback, useEffect, useState } from "react";
import { Drawer, Segmented, Switch, Space, Typography, Divider, Tooltip, Modal } from "antd";
import {
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
  LaptopOutlined,
  SaveOutlined,
  KeyOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import type { ThemeMode } from "../constants";
import { TRANSACTION_RECORDS_KEY } from "../constants";
import type { TransactionStore } from "../types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  recordingEnabled: boolean;
  onRecordingToggle: (enabled: boolean) => void;
  itemDbVersion: string | null;
}

/** 设置面板 — 以 Drawer 形式从右侧滑出 */
export function SettingsPanel({
  open,
  onClose,
  themeMode,
  onThemeModeChange,
  recordingEnabled,
  onRecordingToggle,
  itemDbVersion,
}: SettingsPanelProps) {
  const [recordCount, setRecordCount] = useState(0);
  const [recordSize, setRecordSize] = useState(0);

  useEffect(() => {
    if (!open) return;
    requestIdleCallback(() => {
      const raw = localStorage.getItem(TRANSACTION_RECORDS_KEY);
      if (!raw) { setRecordCount(0); setRecordSize(0); return; }
      try {
        const store = JSON.parse(raw) as TransactionStore;
        const count = Object.values(store).reduce(
          (sum, item) => sum + item.records.length, 0,
        );
        setRecordCount(count);
        setRecordSize(new Blob([raw]).size);
      } catch { /* ignore */ }
    });
  }, [open]);

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

      {/* ---- 物品列表 ---- */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        <DatabaseOutlined style={{ marginRight: 6 }} />
        物品列表
      </Typography.Title>

      <div className="settings-row">
        <div className="settings-row-inline">
          <Typography.Text strong>当前版本</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {itemDbVersion ?? "未知"}
          </Typography.Text>
        </div>
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
              {recordingEnabled
                ? `已保存 ${recordCount} 条（${formatBytes(recordSize)}）`
                : "关闭后将清空所有交易记录"}
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

      <Divider style={{ margin: "20px 0" }} />

      {/* ---- 快捷键 ---- */}
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        <KeyOutlined style={{ marginRight: 6 }} />
        快捷键
      </Typography.Title>

      <div className="settings-shortcuts">
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>Tab</kbd></span>
          <span className="settings-shortcut-desc">打开 / 关闭搜索卡片</span>
        </div>
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>字母/数字</kbd></span>
          <span className="settings-shortcut-desc">唤起搜索</span>
        </div>
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>↑</kbd><kbd>↓</kbd></span>
          <span className="settings-shortcut-desc">切换搜索结果</span>
        </div>
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>Enter</kbd></span>
          <span className="settings-shortcut-desc">选择结果</span>
        </div>
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>Ctrl+V</kbd></span>
          <span className="settings-shortcut-desc">粘贴物品名直接查价</span>
        </div>
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>Esc</kbd></span>
          <span className="settings-shortcut-desc">关闭搜索卡片</span>
        </div>
      </div>
    </Drawer>
  );
}

/** 将字节数格式化为人类可读的字符串 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

