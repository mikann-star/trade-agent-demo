import {
  campaigns,
  merchantLeads,
  operationsMetrics,
  products,
  projectRisks,
} from "./demo-data";

export type DemoArtifact = {
  id?: string;
  kind: "table" | "report" | "csv";
  title: string;
  columns?: string[];
  rows?: Array<Array<string | number>>;
  lines?: string[];
  filename?: string;
  content?: string;
};

export type DemoToolResult = {
  summary: string;
  evidence: string[];
  artifact: DemoArtifact;
};

export function queryOperationsKpis(period: "7d" | "30d"): DemoToolResult {
  const metrics =
    period === "7d" ? operationsMetrics.current7d : operationsMetrics.current30d;
  const title = period === "7d" ? "最近 7 天经营概览" : "最近 30 天经营概览";
  return {
    summary:
      period === "7d"
        ? "GMV 下滑主要由访客下降与转化率同步走弱造成，退款率上升进一步放大了净收入压力。"
        : "近 30 天整体仍保持增长，但转化率小幅走弱，需要关注增长质量。",
    evidence: [
      `GMV ${metrics.gmv.toLocaleString("zh-CN")} 元，环比 ${metrics.gmvChange}%`,
      `访客 ${metrics.visitors.toLocaleString("zh-CN")}，环比 ${metrics.visitorsChange}%`,
      `转化率 ${metrics.conversion}%，变化 ${metrics.conversionChange} 个百分点`,
      `退款率 ${metrics.refundRate}%，变化 +${metrics.refundRateChange} 个百分点`,
    ],
    artifact: {
      kind: "table",
      title,
      columns: ["指标", "当前值", "环比变化", "判断"],
      rows: [
        ["GMV", `¥${metrics.gmv.toLocaleString("zh-CN")}`, `${metrics.gmvChange}%`, metrics.gmvChange < 0 ? "需关注" : "健康"],
        ["访客数", metrics.visitors.toLocaleString("zh-CN"), `${metrics.visitorsChange}%`, metrics.visitorsChange < 0 ? "承压" : "健康"],
        ["转化率", `${metrics.conversion}%`, `${metrics.conversionChange}pp`, metrics.conversionChange < 0 ? "需优化" : "健康"],
        ["退款率", `${metrics.refundRate}%`, `+${metrics.refundRateChange}pp`, "偏高"],
      ],
    },
  };
}

export function diagnoseProduct(sku: string): DemoToolResult {
  const product = products.find(
    (item) => item.sku.toLowerCase() === sku.trim().toLowerCase(),
  );
  if (!product) {
    throw new Error(`未找到商品 ${sku}。可用演示商品：${products.map((item) => item.sku).join("、")}`);
  }
  return {
    summary: `${product.name} GMV 环比 ${product.gmvChange}%，主要问题为：${product.issue}。`,
    evidence: [
      `曝光 ${product.impressions.toLocaleString("zh-CN")}`,
      `点击率 ${product.clickRate}%`,
      `转化率 ${product.conversion}%`,
      `库存可售 ${product.inventoryDays} 天`,
    ],
    artifact: {
      kind: "report",
      title: `${product.sku} 商品诊断`,
      lines: [
        `现状：GMV ¥${product.gmv.toLocaleString("zh-CN")}，环比 ${product.gmvChange}%`,
        `流量：曝光 ${product.impressions.toLocaleString("zh-CN")}，点击率 ${product.clickRate}%`,
        `转化：当前转化率 ${product.conversion}%，优先补全尺码与试穿信息`,
        `动作：更新搜索词包、补充详情页信息、选择 3 位垂类达人进行素材测试`,
      ],
    },
  };
}

export function scoreMerchantLeads(minScore: number): DemoToolResult {
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
    throw new Error("最低潜力分必须在 0 到 100 之间");
  }
  const rows = merchantLeads.filter((lead) => lead.potential >= minScore);
  return {
    summary: `共筛选出 ${rows.length} 个潜力分不低于 ${minScore} 的招商线索。`,
    evidence: rows.map(
      (lead) => `${lead.merchant}：${lead.potential} 分，${lead.reason}`,
    ),
    artifact: {
      kind: "table",
      title: "高潜招商线索",
      columns: ["商家", "品类", "潜力分", "月销售额", "当前状态"],
      rows: rows.map((lead) => [
        lead.merchant,
        lead.category,
        lead.potential,
        `¥${lead.monthlySales.toLocaleString("zh-CN")}`,
        lead.contactStatus,
      ]),
    },
  };
}

export function analyzeCampaign(campaignId: string): DemoToolResult {
  const campaign = campaigns.find(
    (item) => item.id.toLowerCase() === campaignId.trim().toLowerCase(),
  );
  if (!campaign) {
    throw new Error(`未找到活动 ${campaignId}。可用演示活动：SUMMER-01`);
  }
  const completion = Math.round((campaign.registered / campaign.target) * 100);
  return {
    summary: `${campaign.name} 报名完成度 ${completion}%，距离目标还差 ${campaign.target - campaign.registered} 家商家。`,
    evidence: [
      `目标 ${campaign.target} 家，已报名 ${campaign.registered} 家`,
      `已通过 ${campaign.approved} 家，待审核 ${campaign.pending} 家`,
      `截止日期 ${campaign.deadline}`,
    ],
    artifact: {
      kind: "table",
      title: `${campaign.name}报名进度`,
      columns: ["目标", "已报名", "已通过", "待审核", "完成度"],
      rows: [
        [
          campaign.target,
          campaign.registered,
          campaign.approved,
          campaign.pending,
          `${completion}%`,
        ],
      ],
    },
  };
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function exportCampaignFollowups(campaignId: string): DemoToolResult {
  const campaign = campaigns.find(
    (item) => item.id.toLowerCase() === campaignId.trim().toLowerCase(),
  );
  if (!campaign) throw new Error(`未找到活动 ${campaignId}`);
  const header = ["商家", "品类", "待办事项", "优先级"];
  const content = [
    header.map(csvEscape).join(","),
    ...campaign.merchants.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  return {
    summary: `已生成 ${campaign.merchants.length} 条待跟进商家记录。`,
    evidence: ["文件为 UTF-8 CSV", "数据来自内置活动演示数据"],
    artifact: {
      kind: "csv",
      title: `${campaign.name}待跟进清单`,
      filename: "夏季超单活动-待跟进清单.csv",
      content,
    },
  };
}

export function buildProjectPlan(
  objective: string,
  weeks: number,
): DemoToolResult {
  if (!Number.isInteger(weeks) || weeks < 2 || weeks > 8) {
    throw new Error("项目周期必须为 2 到 8 周的整数");
  }
  const lines = Array.from({ length: weeks }, (_, index) => {
    const templates = [
      "统一目标与口径，锁定核心货盘、负责人和里程碑",
      "启动商品与商家执行，完成第一轮素材和价格测试",
      "复盘核心指标，集中处理转化与履约阻塞点",
      "扩大有效策略覆盖，准备阶段性业务复盘",
      "对重点品类进行二次增长实验并跟踪风险",
      "沉淀标准动作、指标看板和下阶段机会清单",
      "完成跨团队复盘并关闭遗留问题",
      "输出最终总结与下一周期路线图",
    ];
    return `第 ${index + 1} 周：${templates[index]}`;
  });
  return {
    summary: `已为“${objective}”生成 ${weeks} 周项目计划，并识别 3 项关键风险。`,
    evidence: projectRisks,
    artifact: {
      kind: "report",
      title: `${objective} · ${weeks} 周计划`,
      lines: [...lines, ...projectRisks.map((risk) => `风险：${risk}`)],
    },
  };
}
