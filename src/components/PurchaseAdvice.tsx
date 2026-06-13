import { useMemo } from "react";
import { Card, Tag, Typography, Row, Col, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
  ThunderboltOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import type { PurchaseAdviceResult } from "../utils/purchaseAdvice";
import { fmtPrice } from "../utils/formatPrice";

interface PurchaseAdviceProps {
  result: PurchaseAdviceResult;
}

/** 购买建议展示组件 */
export function PurchaseAdvice({ result }: PurchaseAdviceProps) {
  const { rating, summary, details } = result;

  const config = useMemo(() => {
    switch (rating) {
      case "buy":
        return {
          icon: <CheckCircleOutlined />,
          color: "#22c55e",
          bgColor: "rgba(34, 197, 94, 0.08)",
          borderColor: "rgba(34, 197, 94, 0.2)",
          label: "推荐购买",
          tagColor: "green",
        };
      case "watch":
        return {
          icon: <WarningOutlined />,
          color: "#f59e0b",
          bgColor: "rgba(245, 158, 11, 0.08)",
          borderColor: "rgba(245, 158, 11, 0.2)",
          label: "谨慎观望",
          tagColor: "orange",
        };
      case "avoid":
        return {
          icon: <CloseCircleOutlined />,
          color: "#ef4444",
          bgColor: "rgba(239, 68, 68, 0.08)",
          borderColor: "rgba(239, 68, 68, 0.2)",
          label: "不推荐",
          tagColor: "red",
        };
      default:
        return {
          icon: <InfoCircleOutlined />,
          color: "#6b7280",
          bgColor: "rgba(107, 114, 128, 0.08)",
          borderColor: "rgba(107, 114, 128, 0.2)",
          label: "数据不足",
          tagColor: "default",
        };
    }
  }, [rating]);

  const trendIcon =
    details.trend === "down" ? (
      <ArrowDownOutlined style={{ color: "#22c55e" }} />
    ) : details.trend === "up" ? (
      <ArrowUpOutlined style={{ color: "#ef4444" }} />
    ) : (
      <MinusOutlined style={{ color: "#6b7280" }} />
    );

  const trendLabel =
    details.trend === "down"
      ? "下降中"
      : details.trend === "up"
        ? "上升中"
        : "平稳";

  const cvLabel =
    details.cv < 0.15
      ? "稳定"
      : details.cv < 0.3
        ? "中等"
        : "高波动";

  const cvColor =
    details.cv < 0.15
      ? "#22c55e"
      : details.cv < 0.3
        ? "#f59e0b"
        : "#ef4444";

  // 价差颜色
  const savingsColor =
    details.savingsPercent > 8
      ? "#22c55e"
      : details.savingsPercent > 3
        ? "#86efac"
        : details.savingsPercent < -5
          ? "#ef4444"
          : "var(--text)";

  return (
    <Card
      className="purchase-advice-card"
      size="small"
      title={<><ThunderboltOutlined /> 购买建议</>}
    >
      {/* 评级横幅 */}
      <div
        className="pa-banner"
        style={{
          background: config.bgColor,
          borderColor: config.borderColor,
        }}
      >
        <Tag
          color={config.tagColor}
          className="pa-rating-tag"
          icon={config.icon}
        >
          {config.label}
        </Tag>
        <Typography.Text className="pa-summary">{summary}</Typography.Text>
      </div>

      {/* 详细数据 */}
      <Row gutter={[12, 10]} className="pa-details">
        {/* 第1列：最低价实付付 */}
        <Col xs={12} sm={8}>
          <Tooltip title={`最低售价 + 5% 市场手续费 = 购买时实际支出`}>
            <div className="pa-item pa-item-tax">
              <div className="pa-label pa-label-tax">
                <PercentageOutlined /> 最低价实付
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value pa-value-current">
                {fmtPrice(details.effectiveBuyPrice)}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第2列：参考价 */}
        <Col xs={12} sm={8}>
          <Tooltip title="低价加权参考价 — 剔除异常值后，越便宜的成交权重越高，反映买家实际能买到的好价格">
            <div className="pa-item">
              <div className="pa-label">
                参考价
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.weightedRefPrice > 0
                  ? fmtPrice(details.weightedRefPrice)
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第3列：价差 */}
        <Col xs={12} sm={8}>
          <Tooltip title={`实付价相比参考价的偏差`}>
            <div className="pa-item">
              <div className="pa-label">
                价差
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div
                className="pa-value"
                style={{ color: savingsColor }}
              >
                {details.weightedRefPrice > 0
                  ? `${details.savingsPercent > 0 ? "" : ""}${details.savingsPercent.toFixed(1)}%`
                  : <span className="pa-na">--</span>}
                {details.savingsPercent > 0 && details.weightedRefPrice > 0 && (
                  <span className="pa-savings">(省 {Math.abs(details.savingsPercent).toFixed(1)}%)</span>
                )}
                {details.savingsPercent <= 0 && details.weightedRefPrice > 0 && (
                  <span className="pa-savings">(贵 {Math.abs(details.savingsPercent).toFixed(1)}%)</span>
                )}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第4列：历史最低 */}
        <Col xs={12} sm={8}>
          <Tooltip
            title={
              details.lowestPriceRecord
                ? `${details.lowestPriceRecord.worldName} · ${details.lowestPriceRecord.buyerName} · ${new Date(details.lowestPriceRecord.timestamp * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}${details.lowestPriceRecord.hq ? " · HQ" : ""}`
                : "本地存储的历史成交价最低值"
            }
          >
            <div className="pa-item">
              <div className="pa-label">
                历史最低
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.historicalLowestPrice > 0
                  ? fmtPrice(details.historicalLowestPrice)
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第5列：主流低位 */}
        <Col xs={12} sm={8}>
          <Tooltip title="P25 百分位 — 历史成交价中最低的 25% 分界线，低于此价属于低价区间">
            <div className="pa-item">
              <div className="pa-label">
                主流低位
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.percentile25 > 0
                  ? fmtPrice(details.percentile25)
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第6列：主流高位 */}
        <Col xs={12} sm={8}>
          <Tooltip title="P75 百分位 — 历史成交价中最高的 25% 分界线，高于此价属于高价区间">
            <div className="pa-item">
              <div className="pa-label">
                主流高位
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.percentile75 > 0
                  ? fmtPrice(details.percentile75)
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>

        {/* 第3行：辅助指标 */}
        <Col xs={12} sm={6}>
          <Tooltip title="EWMA 指数加权均价 — 近期成交赋予更高权重">
            <div className="pa-item">
              <div className="pa-label">
                加权均价
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.ewmaPrice > 0
                  ? fmtPrice(details.ewmaPrice)
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col xs={12} sm={6}>
          <Tooltip title="变异系数 CV = 标准差 ÷ 均值">
            <div className="pa-item">
              <div className="pa-label">
                波动率
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value" style={{ color: cvColor }}>
                {details.cv > 0
                  ? `${(details.cv * 100).toFixed(1)}% · ${cvLabel}`
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col xs={12} sm={6}>
          <Tooltip title="基于 EWMA 的近期 vs 远期价格趋势">
            <div className="pa-item">
              <div className="pa-label">
                价格趋势
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value pa-trend">
                {trendIcon}
                <span style={{ marginLeft: 4 }}>{trendLabel}</span>
              </div>
            </div>
          </Tooltip>
        </Col>
        <Col xs={12} sm={6}>
          <Tooltip title={`近 7 天成交 ${details.recentWeekCount} 笔 / 共 ${details.recordCount} 笔`}>
            <div className="pa-item">
              <div className="pa-label">
                活跃度
                <InfoCircleOutlined className="pa-info-icon" />
              </div>
              <div className="pa-value">
                {details.recordCount > 0
                  ? `${details.recentWeekCount} / ${details.recordCount}`
                  : <span className="pa-na">暂无</span>}
              </div>
            </div>
          </Tooltip>
        </Col>
      </Row>
    </Card>
  );
}
