import { Modal, Typography, Divider } from "antd";
import {
  InfoCircleOutlined,
  DatabaseOutlined,
  KeyOutlined,
} from "@ant-design/icons";

interface InfoDialogProps {
  open: boolean;
  onClose: () => void;
  itemDbVersion: string | null;
}

/** 信息弹窗：物品列表版本 + 快捷键 */
export function InfoDialog({ open, onClose, itemDbVersion }: InfoDialogProps) {
  return (
    <Modal
      title={<span><InfoCircleOutlined style={{ marginRight: 8 }} />信息</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={400}
      styles={{ body: { padding: "20px 24px" } }}
    >
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
        <div className="settings-shortcut">
          <span className="settings-shortcut-keys"><kbd>`</kbd></span>
          <span className="settings-shortcut-desc">打开 / 关闭历史侧栏</span>
        </div>
      </div>
    </Modal>
  );
}
