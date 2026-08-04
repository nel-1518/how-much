import { useEffect, useState, useCallback } from "react";
import { Modal, Switch, Space, Typography, Tooltip } from "antd";
import {
  SettingOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { TRANSACTION_RECORDS_KEY } from "../constants";
import type { TransactionStore } from "../types";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  recordingEnabled: boolean;
  onRecordingToggle: (enabled: boolean) => void;
}

/** 设置弹窗：交易记录 */
export function SettingsDialog({
  open,
  onClose,
  recordingEnabled,
  onRecordingToggle,
}: SettingsDialogProps) {
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
