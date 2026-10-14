import { Button, Popconfirm, Space, Typography } from "antd";
import { ClockCircleOutlined, ClearOutlined, PushpinOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSearchHistoryContext } from "../contexts/SearchHistoryContext";

/** 搜索历史标签列表组件 */
export function HistorySection() {
  const { sortedHistory, searchFromHistory, removeHistory, clearHistory, togglePin } =
    useSearchHistoryContext();
  return (
    <div className="search-history">
      {sortedHistory.length === 0 ? (
        <div className="history-empty">
          <Typography.Text type="secondary">暂无搜索历史</Typography.Text>
        </div>
      ) : (
        <>
          <div className="search-history-header">
            <span className="search-history-title">
              <ClockCircleOutlined /> 搜索历史
            </span>
            <Space size="small">
              <Popconfirm title="确定清空全部搜索历史？" onConfirm={clearHistory} okText="确定" cancelText="取消">
                <Button type="text" size="small" icon={<ClearOutlined />} className="history-clear-btn">清空</Button>
              </Popconfirm>
            </Space>
          </div>
          <div className="search-history-list">
            {sortedHistory.map((item) => (
              <div
                key={item.id}
                className={`search-history-item${item.pinned ? " pinned" : ""}`}
                onClick={() => searchFromHistory(item)}
              >
                <span className="search-history-name">{item.name}</span>
                <Button type="text" size="small" icon={<PushpinOutlined />}
                  onClick={(e) => { e.stopPropagation(); togglePin(item.id); }}
                  title={item.pinned ? "取消固定" : "固定到最前"}
                  className="history-pin-btn"
                />
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
                  className="history-del-btn"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
