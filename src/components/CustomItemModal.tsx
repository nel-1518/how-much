import { useCallback, useMemo } from "react";
import { Modal, Form, Input, Button, Table, message, Popconfirm, Typography, Divider, Empty, Space, Upload } from "antd";
import { DeleteOutlined, PlusOutlined, AppstoreAddOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import type { CustomItemStore, CustomItem } from "../types";

interface CustomItemModalProps {
  open: boolean;
  onClose: () => void;
  customItems: CustomItemStore;
  onSave: (items: CustomItemStore) => void;
}

/** 自定义物品管理Modal */
export function CustomItemModal({ open, onClose, customItems, onSave }: CustomItemModalProps) {
  const [form] = Form.useForm();

  const sortedItems = useMemo(
    () => Object.values(customItems).sort((a, b) => b.addedTime - a.addedTime),
    [customItems],
  );

  const handleAddItem = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const { itemName, itemId } = values;

      if (customItems[String(itemId)]) {
        message.warning("该物品ID已存在，请勿重复添加");
        return;
      }

      const newItems = {
        ...customItems,
        [itemId]: { name: itemName, itemId: parseInt(itemId), addedTime: Date.now() },
      };

      onSave(newItems);
      form.resetFields();
      message.success(`「${itemName}」已添加`);
    } catch {
      /* 表单验证失败 */
    }
  }, [form, customItems, onSave]);

  const handleRemoveItem = useCallback(
    (itemId: number, itemName: string) => {
      const newItems = { ...customItems };
      delete newItems[String(itemId)];
      onSave(newItems);
      message.success(`「${itemName}」已删除`);
    },
    [customItems, onSave],
  );

  /** 导出为 JSON 文件 */
  const handleExport = useCallback(() => {
    const count = Object.keys(customItems).length;
    if (count === 0) {
      message.warning("暂无物品可导出");
      return;
    }
    const blob = new Blob([JSON.stringify(customItems, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ff14-custom-items-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(`已导出 ${count} 个物品`);
  }, [customItems]);

  /** 导入 JSON 文件 */
  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let imported: CustomItemStore;
        try {
          imported = JSON.parse(e.target?.result as string);
        } catch {
          message.error("文件格式错误，请选择有效的 JSON 文件");
          return;
        }

        // 校验格式
        if (typeof imported !== "object" || imported === null) {
          message.error("无效的数据格式");
          return;
        }

        const entries = Object.entries(imported);
        if (entries.length === 0) {
          message.warning("文件中没有物品数据");
          return;
        }

        let validCount = 0;
        const newItems = { ...customItems };

        for (const [key, val] of entries) {
          if (
            val &&
            typeof val === "object" &&
            typeof val.name === "string" &&
            typeof val.itemId === "number"
          ) {
            newItems[key] = {
              name: val.name,
              itemId: val.itemId,
              addedTime: val.addedTime || Date.now(),
            } as CustomItem;
            validCount++;
          }
        }

        if (validCount === 0) {
          message.error("文件中没有找到有效的物品数据");
          return;
        }

        const addedCount = validCount;
        onSave(newItems);
        message.success(`成功导入 ${addedCount} 个物品`);
      };
      reader.readAsText(file);
      // 阻止 Upload 默认上传行为
      return false;
    },
    [customItems, onSave],
  );

  const columns = [
    {
      title: "物品名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "物品ID",
      dataIndex: "itemId",
      key: "itemId",
      width: 110,
    },
    {
      title: "操作",
      key: "action",
      width: 72,
      align: "center" as const,
      render: (_: unknown, record: (typeof sortedItems)[0]) => (
        <Popconfirm
          title="删除物品"
          description={`确定要删除「${record.name}」吗？`}
          onConfirm={() => handleRemoveItem(record.itemId, record.name)}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          placement="left"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={
        <span>
          <AppstoreAddOutlined style={{ marginRight: 8 }} />
          自定义物品
        </span>
      }
      open={open}
      onCancel={onClose}
      width={580}
      footer={
        <Button onClick={onClose} type="default">
          关闭
        </Button>
      }
      destroyOnClose
    >
      {/* 添加区域 — 紧凑行内布局 */}
      <Form form={form} layout="inline" size="middle" onFinish={handleAddItem}>
        <Form.Item
          name="itemName"
          style={{ flex: 1, minWidth: 160 }}
          rules={[
            { required: true, message: "请输入物品名称" },
            { max: 50, message: "名称不超过50个字符" },
          ]}
        >
          <Input placeholder="物品名称" allowClear />
        </Form.Item>
        <Form.Item
          name="itemId"
          style={{ width: 140 }}
          rules={[
            { required: true, message: "请输入物品ID" },
            { pattern: /^\d+$/, message: "ID 必须是数字" },
          ]}
        >
          <Input placeholder="物品ID" allowClear />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            添加
          </Button>
        </Form.Item>
      </Form>

      <Divider style={{ margin: "20px 0 16px" }} />

      {/* 列表区域 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          已添加 {sortedItems.length} 个物品
        </Typography.Text>
        <Space size={4}>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button type="text" size="small" icon={<UploadOutlined />}>
              导入
            </Button>
          </Upload>
          <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      {sortedItems.length > 0 ? (
        <Table
          columns={columns}
          dataSource={sortedItems}
          rowKey="itemId"
          pagination={false}
          size="small"
          scroll={{ y: 320 }}
          style={{ maxHeight: 320 }}
          locale={{ emptyText: <Empty description="暂无物品" /> }}
        />
      ) : (
        <Empty
          description="暂无自定义物品"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: "40px 0" }}
        />
      )}
    </Modal>
  );
}
