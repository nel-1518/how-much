import { useEffect, useState, useCallback } from "react";
import { Modal, Switch, Space, Typography, Tooltip, Segmented } from "antd";
import {
  SettingOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
  NumberOutlined,
} from "@ant-design/icons";
import { TRANSACTION_RECORDS_KEY, type PriceFormat } from "../constants";
import { loadPriceFormat, savePriceFormat } from "../utils/formatPrice";
import type { TransactionStore } from "../types";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  recordingEnabled: boolean;
  onRecordingToggle: (enabled: boolean) => void;
}

const PRICE_FORMAT_OPTIONS: { label: string; value: PriceFormat; example: string }[] = [
  { label: "千分位", value: "comma", example: "1,234,567" },
  { label: "四位空格", value: "space4", example: "123 4567" },
];

/** 设置弹窗：交易记录 + 金额显示格式 */
export function SettingsDialog({
  open,
  onClose,
  recordingEnabled,
  onRecordingToggle,
}: SettingsDialogProps) {
  const [recordCount, setRecordCount] = useState(0);
  const [recordSize, setRecordSize] = useState(0);
  // 金额格式：弹窗内部自管（打开时读本地存储，选择即保存；页面重载后生效）
  const [priceFormat, setPriceFormat] = useState<PriceFormat>(loadPriceFormat);

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
    <Modal
      title={<span><SettingOutlined style={{ marginRight: 8 }} />设置</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={380}
      styles={{ body: { padding: "20px 24px" } }}
    >
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

      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
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
          savePriceFormat(v);
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

/** 将字节数格式化为人类可读的字符串 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
