import { Button, Empty, Popconfirm } from "antd";
import { UnorderedListOutlined, DeleteOutlined, ClearOutlined } from "@ant-design/icons";
import type { SavedBatchSet } from "../hooks/useSavedItemSets";
import { useSidebar } from "../contexts/SidebarContext";
import { Sidebar } from "./Sidebar";

interface BatchSetsSidebarProps {
  /** 已保存的物品集 */
  sets: SavedBatchSet[];
  /** 当前已载入的物品集 id（用于高亮） */
  activeSetId?: string;
  /** 是否存在已保存物品集（决定「清空」按钮是否可用） */
  hasSets: boolean;
  /** 点击物品集：载入到批量查价 */
  onLoad: (set: SavedBatchSet) => void;
  /** 删除物品集 */
  onRemove: (id: string) => void;
  /** 一键清空全部已保存物品集 */
  onClearSets: () => void;
}

/** 批量查价页左侧栏：已保存物品集列表，点击即可快速载入 */
export function BatchSetsSidebar({
  sets,
  activeSetId,
  hasSets,
  onLoad,
  onRemove,
  onClearSets,
}: BatchSetsSidebarProps) {
  const { close } = useSidebar();

  const handleSelect = (set: SavedBatchSet) => {
    onLoad(set);
    // 移动端选择后自动收起，桌面端保持展开方便连续浏览
    if (window.innerWidth <= 768) close();
  };

  return (
    <Sidebar
      ariaLabel="物品集"
      title={<><UnorderedListOutlined /> 物品集</>}
      headerActions={
        <Popconfirm
          title="确定清空全部物品集？"
          description="所有已保存的物品集都会被删除。"
          okText="清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={onClearSets}
          disabled={!hasSets}
        >
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            className="sidebar-header-btn"
            title="清空全部物品集"
            disabled={!hasSets}
          />
        </Popconfirm>
      }
    >
      {sets.length === 0 ? (
        <div className="sidebar-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无物品集" />
        </div>
      ) : (
        sets.map((set) => (
          <div
            key={set.id}
            className={`sidebar-item has-count${set.id === activeSetId ? " active" : ""}`}
            onClick={() => handleSelect(set)}
          >
            <span className="sidebar-item-name" title={set.name}>{set.name}</span>
            <span className="sidebar-set-count">{set.items.length} 件</span>
            <span
              className="sidebar-item-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <Popconfirm
                title={`确定删除物品集「${set.name}」？`}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => onRemove(set.id)}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  title="删除"
                  className="sidebar-item-btn"
                />
              </Popconfirm>
            </span>
          </div>
        ))
      )}
    </Sidebar>
  );
}
