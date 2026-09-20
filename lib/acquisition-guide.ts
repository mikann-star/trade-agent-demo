// Read-only capability overview from the approved 招商 introduction.
// These entries are not executable Skills and must stay outside the Skill catalog.
export const acquisitionGuide = {
  sceneId: "acquisition",
  title: "招商 Agent 能帮你做什么？",
  description:
    "支持招商线索获取、商家信息采集、靶向池清洗与商家触达。目前需配合 DewuClaw 使用，暂不支持在交易智能助手中直接调用。具体使用方式请查看下方指南。",
  documentUrl: "https://poizon.feishu.cn/wiki/V1QTwsP7AiFcdBkypVDcjTaMndb",
  documentLabel: "查看使用指南",
  capabilities: [
    {
      id: "xianyu-leads",
      title: "闲鱼招商线索获取",
      description:
        "按关键词批量查找闲鱼潜在商家，采集店铺、销量、粉丝及联系方式等信息，支持去重、站内消息初步触达，并将结果写入飞书表格、通知采集进度。",
    },
    {
      id: "merchant-information",
      title: "平台爬虫个人版",
      description:
        "根据淘宝店铺链接，批量采集营业执照、企业名称、统一社会信用代码、法定代表人及联系方式等商家信息，自动回写飞书表格。",
    },
    {
      id: "target-pool",
      title: "招商靶向池清洗",
      description:
        "整合抖音、天猫、淘宝、小红书等平台的商家排名数据，结合得物品牌、类目及 GMV 数据评估招商价值，输出优先级排序和可跟进的靶向池。",
    },
    {
      id: "im-outreach",
      title: "IM招商工具",
      description:
        "从飞书表格读取目标商家及话术模板，支持向闲鱼、淘宝／天猫商家发送招商邀请，并回写发送状态和失败原因。",
    },
  ],
} as const;
