import { Button, Tooltip, Popconfirm, Switch, Space } from "antd";
import { ClockCircleOutlined, ClearOutlined, PushpinOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import type { SearchHistoryItem } from "../types";

interface HistorySectionProps {
  sortedHistory: SearchHistoryItem[];
  onSearchFromHistory: (item: SearchHistoryItem) => void;
  onRemoveHistory: (id: number) => void;
  onClearHistory: () => void;
  onTogglePin: (id: number) => void;
  recordingEnabled: boolean;
  onRecordingToggle: (enabled: boolean) => void;
}

/** 搜索历史标签列表组件 */
export function HistorySection({
  sortedHistory, onSearchFromHistory, onRemoveHistory, onClearHistory, onTogglePin,
  recordingEnabled, onRecordingToggle,
}: HistorySectionProps) {
  if (sortedHistory.length === 0 && !recordingEnabled) return null;

  return (
    <div className="search-history">
      <div className="search-history-header">
        <span className="search-history-title">
          <ClockCircleOutlined /> 搜索历史
        </span>
        <Space size="small">
          <Tooltip title={recordingEnabled ? "关闭后将清空所有交易记录" : "开启后自动保存交易记录"}>
            <span className="history-record-label">
              <SaveOutlined /> 记录
            </span>
            <Switch
              size="small"
              checked={recordingEnabled}
              onChange={onRecordingToggle}
              className="history-record-switch"
            />
          </Tooltip>
          <Popconfirm title="确定清空全部搜索历史？" onConfirm={onClearHistory} okText="确定" cancelText="取消">
            <Button type="text" size="small" icon={<ClearOutlined />} className="history-clear-btn">清空</Button>
          </Popconfirm>
        </Space>
      </div>
      <div className="search-history-list">
        {sortedHistory.map((item) => (
          <div
            key={item.id}
            className={`search-history-item${item.pinned ? " pinned" : ""}`}
            onClick={() => onSearchFromHistory(item)}
          >
            <span className="search-history-name">{item.name}</span>
            <Tooltip title={item.pinned ? "取消固定" : "固定到最前"}>
              <Button type="text" size="small" icon={<PushpinOutlined />}
                onClick={(e) => { e.stopPropagation(); onTogglePin(item.id); }}
                className="history-pin-btn"
              />
            </Tooltip>
            <Button type="text" size="small" icon={<DeleteOutlined />}
              onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.id); }}
              className="history-del-btn"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
