// Read-only external capabilities, not executable Skills.
export const marketingGuide = {
  sceneId: "campaign",
  title: "营销 Agent 能帮你做什么？",
  description:
    "支持报名进度管理、反向提报绿通、活动答疑、会场搭建与调优，以及活动数据查询与分析。目前需在哪吒后台或飞书群中通过机器人使用，暂不支持在交易智能助手中直接调用，具体使用方式请查看下方指南。",
  documentUrl: "https://poizon.feishu.cn/wiki/EcvlwApj4igKZzk5Nlzcvq1Ynie",
  documentLabel: "查看使用指南",
  sceneLabel: "需在哪吒后台或飞书群使用",
  channels: {
    feishu: {
      label: "飞书群机器人",
      instruction: "在指南对应飞书群中 @活动小助手 使用",
    },
    nezha: {
      label: "哪吒后台",
      instruction: "点击哪吒后台右上角「试试AI」使用",
    },
  },
  capabilities: [
    {
      id: "registration-progress",
      title: "报名进度管理",
      description:
        "查询各级管理类目的活动报名进度，支持跨活动去重查询；导出可报名、已报名、未报名的商品与商家明细，并查询导出任务进度。重点品查询与导出需按指南配置飞书表。",
      channel: "feishu",
    },
    {
      id: "fast-track-submission",
      title: "反向提报绿通",
      description:
        "根据活动 ID 和 SPU ID 检查商品是否符合绿通规则，符合条件的商品可直接加入品池。目前适用于大促，其他活动的支持范围以指南为准。",
      channel: "feishu",
    },
    {
      id: "activity-questions",
      title: "活动答疑",
      description:
        "查询活动详情、商品和订单参与的活动、报名价格门槛；解答大促、平商共补券、首单礼金及兴趣人群活动的规则问题。对外回复前需由运营确认。",
      channel: "feishu",
    },
    {
      id: "venue-building",
      title: "会场搭建与调优",
      description:
        "支持通过模板、复制会场、飞书表格或自然语言创建与编辑会场，以及 AI 生图、数据通知、文案合规走查、会场评估、模板推荐与操作答疑。",
      channel: "nezha",
    },
    {
      id: "activity-data",
      title: "活动数据查询与分析",
      description:
        "查询具体主活动的整体效果、主要监测和复盘指标，并提供简单分析。",
      channel: "feishu",
    },
  ],
} as const;
