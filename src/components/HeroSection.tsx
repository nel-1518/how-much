import { Typography } from "antd";
import { DollarOutlined } from "@ant-design/icons";

/** 初始欢迎页主视觉区域 */
export function HeroSection() {
  return (
    <div className="hero-section">
      <div className="hero-icon">
        <DollarOutlined />
      </div>
      <Typography.Title level={1} className="hero-title">
        FF14 市场查价
      </Typography.Title>
      <Typography.Text className="hero-desc">
        搜索物品，查询全大区市场价格与交易记录
      </Typography.Text>
    </div>
  );
}
