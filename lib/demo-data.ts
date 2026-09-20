export const operationsMetrics = {
  current7d: {
    gmv: 1284600,
    gmvChange: -12.4,
    visitors: 384200,
    visitorsChange: -5.8,
    conversion: 2.31,
    conversionChange: -0.42,
    orders: 8876,
    ordersChange: -10.9,
    refundRate: 6.8,
    refundRateChange: 1.3,
  },
  current30d: {
    gmv: 5782400,
    gmvChange: 4.7,
    visitors: 1628000,
    visitorsChange: 8.1,
    conversion: 2.47,
    conversionChange: -0.18,
    orders: 40211,
    ordersChange: 3.2,
    refundRate: 5.9,
    refundRateChange: 0.4,
  },
};

export const products = [
  {
    sku: "SNK-2048",
    name: "复古厚底缓震运动鞋",
    category: "运动鞋",
    gmv: 186240,
    gmvChange: -18.6,
    impressions: 182000,
    clickRate: 4.2,
    conversion: 1.86,
    inventoryDays: 42,
    issue: "搜索曝光下降，详情页尺码信息导致转化损失",
  },
  {
    sku: "BAG-8821",
    name: "轻量通勤托特包",
    category: "箱包",
    gmv: 264800,
    gmvChange: 21.8,
    impressions: 246000,
    clickRate: 5.7,
    conversion: 2.94,
    inventoryDays: 18,
    issue: "增长健康，可扩充同色系和小尺寸款",
  },
  {
    sku: "DRS-3170",
    name: "法式收腰连衣裙",
    category: "女装",
    gmv: 148930,
    gmvChange: 7.4,
    impressions: 151000,
    clickRate: 4.9,
    conversion: 2.38,
    inventoryDays: 23,
    issue: "内容点击良好，需提升达人短视频覆盖",
  },
];

export const merchantLeads = [
  {
    merchant: "北屿运动",
    category: "运动户外",
    potential: 92,
    monthlySales: 6800000,
    contactStatus: "待首次沟通",
    reason: "站外增长快，核心价格带与平台缺口匹配",
  },
  {
    merchant: "白昼集合",
    category: "女装",
    potential: 88,
    monthlySales: 5200000,
    contactStatus: "已发送方案",
    reason: "内容能力强，新品供给稳定",
  },
  {
    merchant: "Morrow Lab",
    category: "箱包",
    potential: 84,
    monthlySales: 4300000,
    contactStatus: "二次跟进",
    reason: "年轻客群重合度高，联名合作意愿明确",
  },
  {
    merchant: "造物鞋研社",
    category: "潮流鞋服",
    potential: 79,
    monthlySales: 3600000,
    contactStatus: "资料待补充",
    reason: "原创款占比高，但履约能力需进一步确认",
  },
];

export const campaigns = [
  {
    id: "SUMMER-01",
    name: "夏季超单活动",
    target: 180,
    registered: 136,
    approved: 108,
    pending: 28,
    deadline: "2026-08-05",
    merchants: [
      ["北屿运动", "运动鞋", "待补充库存证明", "高"],
      ["白昼集合", "女装", "待确认活动价", "高"],
      ["Morrow Lab", "箱包", "素材审核中", "中"],
      ["造物鞋研社", "潮流鞋服", "资质文件不完整", "中"],
      ["弦月配饰", "配饰", "尚未提交商品", "低"],
    ],
  },
];

export const projectRisks = [
  "核心货盘锁定晚于营销排期，需在第一周完成供给确认",
  "运营口径与数据看板指标不一致，需指定唯一指标负责人",
  "跨团队决策链路较长，建议设置每周两次 20 分钟站会",
];
