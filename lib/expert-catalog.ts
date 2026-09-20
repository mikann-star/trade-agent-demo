export type ExpertSkill = {
  id: string;
  name: string;
  description: string;
  standardQuestion: string;
};

export type ExpertDefinition = {
  id: string;
  name: string;
  description: string;
  abilityCount: number;
  category: string;
  categoryDescription: string;
  skills: ExpertSkill[];
};

export const expertCatalog: ExpertDefinition[] = [
  {
    id: "merchant",
    name: "商家运营专家",
    description: "数据诊断、商家管理、出价分析、寄存仓储",
    abilityCount: 25,
    category: "日常运营",
    categoryDescription:
      "日常业务答疑、基础数据分析、运营问题定位和部分查询类任务处理，提升信息获取、问题分析和决策辅助效率。",
    skills: [
      {
        id: "product-diagnosis",
        name: "单品诊断",
        description:
          "输入商品 ID 和分析周期，输出 GMV 异动、流量转化分析与运营建议",
        standardQuestion:
          "请诊断商品【商品ID】在【时间范围】内的 GMV、流量和转化表现，并给出运营建议。",
      },
      {
        id: "business-qa",
        name: "答疑能力",
        description: "在对话框直接输入问题，从业务知识库检索答案",
        standardQuestion: "请解答这个业务问题：【问题】。",
      },
      {
        id: "merchant-violation",
        name: "商家违规单查询",
        description: "查询指定商家的违规处罚记录",
        standardQuestion: "请查询商家【商家ID】的违规处罚记录。",
      },
      {
        id: "merchant-qualification",
        name: "商家资质查询",
        description: "查询资质是否过期、出价权限、品牌直发资格等",
        standardQuestion:
          "请查询商家【商家ID】的资质是否过期、出价权限和品牌直发资格。",
      },
      {
        id: "fee-order",
        name: "手续费订单查询与解析",
        description: "查询子订单手续费计算来源和明细",
        standardQuestion:
          "请查询子订单【子订单ID】的手续费计算来源和明细。",
      },
      {
        id: "damage-order",
        name: "受损单诊断",
        description: "诊断订单受损情况，判断能否申诉",
        standardQuestion:
          "请诊断订单【订单ID】的受损情况，并判断是否可以申诉。",
      },
      {
        id: "experience-score",
        name: "商家商品体验综合分解读",
        description:
          "商家 ID + 商品 ID + 考核周期，生成标准体验分报告",
        standardQuestion:
          "请解读商家【商家ID】、商品【商品ID】在【考核周期】内的商品体验综合分。",
      },
      {
        id: "direct-shipping",
        name: "商家直发资格查询",
        description: "查询商家直发资格与绩效",
        standardQuestion:
          "请查询商家【商家ID】的直发资格和近期绩效。",
      },
      {
        id: "bid-permission",
        name: "出价权限查询",
        description: "查询商家或商品是否具备出价权限",
        standardQuestion:
          "请查询商家【商家ID】或商品【商品ID】是否具备出价权限。",
      },
      {
        id: "oos-bd-bid",
        name: "AI 辅助 BD 出价（缺货 BD）",
        description:
          "缺货 BD 全流程：推送、卖家查询、话术、清单与效果追踪",
        standardQuestion:
          "请为缺货 BD 场景生成针对【商品/商家】的卖家清单、沟通话术和跟进计划。",
      },
      {
        id: "new-bd-bid",
        name: "AI 辅助 BD 出价（新品 BD）",
        description:
          "新品 BD 全流程：推送、卖家查询、话术、清单与效果追踪",
        standardQuestion:
          "请为新品 BD 场景生成针对【商品/商家】的卖家清单、沟通话术和跟进计划。",
      },
      {
        id: "bid-expiry",
        name: "指定出价到期日通知及提醒",
        description: "出价到期日自动通知与提醒",
        standardQuestion:
          "请查询【出价单ID】的到期日，并生成通知提醒计划。",
      },
      {
        id: "bid-purchase-order",
        name: "出价单查询、求购单查询",
        description: "查询出价单和求购单详细信息",
        standardQuestion:
          "请查询出价单或求购单【单据ID】的详细信息。",
      },
      {
        id: "auto-follow-bid",
        name: "自动跟价配置、出价售后服务、区域出价配置",
        description:
          "自动跟价配置、出价售后问题处理与区域出价管理",
        standardQuestion:
          "请检查商家【商家ID】的自动跟价、出价售后和区域出价配置。",
      },
      {
        id: "bid-deposit",
        name: "出价保证金查询、出价取消原因",
        description: "查询保证金与出价取消原因分析",
        standardQuestion:
          "请查询出价单【出价单ID】的保证金状态和取消原因。",
      },
      {
        id: "bid-risk-control",
        name: "出价上下限、出价风控结果、一品一商查询",
        description:
          "出价价格区间、风控结果及一品一商状态查询",
        standardQuestion:
          "请查询商品【商品ID】的出价上下限、风控结果和一品一商状态。",
      },
      {
        id: "simulated-bid",
        name: "模拟出价（出价流程卡点分析）",
        description: "模拟出价流程与卡点分析，判断出价可行性",
        standardQuestion:
          "请针对商家【商家ID】和商品【商品ID】模拟出价流程并定位卡点。",
      },
      {
        id: "collectible-price-gap",
        name: "潮玩价格差",
        description: "查询潮玩有无原盒及品牌价格差",
        standardQuestion:
          "请查询潮玩商品【商品ID】的原盒状态及品牌价格差。",
      },
      {
        id: "bargain-order",
        name: "缺货 / 高折扣还价订单查询",
        description:
          "查询缺货还价和高折扣还价订单，多渠道分类筛选",
        standardQuestion:
          "请查询【时间范围】内的缺货及高折扣还价订单，并按渠道分类汇总。",
      },
      {
        id: "domestic-minimum-bid",
        name: "国内企业最低出价",
        description: "查询国内企业资质商家出价信息",
        standardQuestion:
          "请查询商品【商品ID】对应的国内企业资质商家最低出价。",
      },
      {
        id: "warehouse-circle",
        name: "仓储托管圈品数据处理（交易履约团队使用）",
        description: "仓储托管圈品数据处理，自动处理 Excel 文件",
        standardQuestion:
          "请处理上传的仓储托管圈品 Excel，并输出整理结果。",
      },
      {
        id: "inbound-flow",
        name: "入仓单基础信息和库存流向分析",
        description:
          "查询入仓单综合信息：基础、物流、费用与出库流向",
        standardQuestion:
          "请分析入仓单【入仓单ID】的基础信息、物流、费用和库存流向。",
      },
      {
        id: "warehouse-admission",
        name: "商家 × 商品入仓准入分析",
        description: "判断商家与商品是否可入仓",
        standardQuestion:
          "请判断商家【商家ID】与商品【商品ID】是否满足入仓准入条件。",
      },
      {
        id: "consignment-query",
        name: "寄存单据综合查询分析",
        description: "查询寄存域各种业务单据信息",
        standardQuestion:
          "请查询寄存单据【单据ID】的综合业务信息。",
      },
    ],
  },
  {
    id: "product",
    name: "商品运营专家",
    description: "商品表现、趋势词挖掘、上架建议、标题优化",
    abilityCount: 5,
    category: "商品运营",
    categoryDescription:
      "围绕商品表现、市场趋势与上架效率提供分析和运营建议。",
    skills: [
      {
        id: "product-performance",
        name: "商品表现分析",
        description: "对比 GMV、访客、转化率和退款率变化",
        standardQuestion:
          "请分析商品【商品ID】在【时间范围】内的 GMV、访客、转化率和退款率变化。",
      },
      {
        id: "trend-keyword",
        name: "趋势词挖掘",
        description: "识别近期增长词与潜力搜索需求",
        standardQuestion:
          "请挖掘【类目】在【时间范围】内的增长趋势词和潜力搜索需求。",
      },
      {
        id: "semantic-selection",
        name: "语义圈品",
        description: "根据业务描述自动匹配候选商品池",
        standardQuestion:
          "请根据业务需求“【需求描述】”匹配候选商品池。",
      },
      {
        id: "listing-advice",
        name: "上架建议",
        description: "生成上架节奏、价格与素材建议",
        standardQuestion:
          "请为商品【商品ID】生成上架节奏、价格和素材建议。",
      },
      {
        id: "title-optimization",
        name: "标题优化",
        description: "基于搜索意图改写商品标题",
        standardQuestion:
          "请根据搜索意图优化商品【商品ID】的标题。",
      },
    ],
  },
  {
    id: "acquisition",
    name: "招商专家",
    description: "线索筛选、商家评分、资质核验、招商建议",
    abilityCount: 5,
    category: "招商",
    categoryDescription:
      "从招商线索中识别高潜商家，辅助资质核验、评分与跟进。",
    skills: [
      {
        id: "lead-filtering",
        name: "招商线索筛选",
        description: "按类目、规模和经营表现筛选商家",
        standardQuestion:
          "请按【类目】、【商家规模】和【经营表现要求】筛选招商线索。",
      },
      {
        id: "merchant-scoring",
        name: "商家评分",
        description: "使用确定性指标生成招商优先级",
        standardQuestion:
          "请对招商线索【线索范围】进行商家评分并生成优先级。",
      },
      {
        id: "qualification-check",
        name: "资质核验",
        description: "检查商家资质状态和风险项",
        standardQuestion:
          "请核验商家【商家ID】的资质状态和风险项。",
      },
      {
        id: "category-gap",
        name: "类目缺口分析",
        description: "定位供给不足和重点招商类目",
        standardQuestion:
          "请分析【类目】的供给缺口并识别重点招商方向。",
      },
      {
        id: "acquisition-advice",
        name: "招商建议",
        description: "生成招商话术和下一步跟进动作",
        standardQuestion:
          "请为商家【商家ID】生成招商话术和下一步跟进建议。",
      },
    ],
  },
  {
    id: "campaign",
    name: "营销活动专家",
    description: "活动报名、进度诊断、素材检查、清单导出",
    abilityCount: 5,
    category: "营销活动",
    categoryDescription:
      "覆盖活动筹备、报名推进、过程诊断和执行清单整理。",
    skills: [
      {
        id: "signup-progress",
        name: "报名进度分析",
        description: "汇总活动报名率和待跟进商家",
        standardQuestion:
          "请汇总活动【活动ID】的报名进度和待跟进商家。",
      },
      {
        id: "campaign-diagnosis",
        name: "活动诊断",
        description: "识别报名、素材与商品供给异常",
        standardQuestion:
          "请诊断活动【活动ID】的报名、素材和商品供给异常。",
      },
      {
        id: "material-check",
        name: "素材检查",
        description: "检查活动素材完整性和规范风险",
        standardQuestion:
          "请检查活动【活动ID】的素材完整性和规范风险。",
      },
      {
        id: "campaign-roster",
        name: "活动清单导出",
        description: "生成可下载的报名与跟进清单",
        standardQuestion:
          "请导出活动【活动ID】的报名和跟进清单。",
      },
      {
        id: "campaign-review",
        name: "活动复盘",
        description: "对比目标与结果并形成复盘结论",
        standardQuestion:
          "请对活动【活动ID】的目标与结果进行复盘并给出改进建议。",
      },
    ],
  },
  {
    id: "project",
    name: "项目管理专家",
    description: "项目计划、风险识别、行动拆解、进度追踪",
    abilityCount: 5,
    category: "项目管理",
    categoryDescription:
      "将目标拆成可执行计划，识别风险并持续追踪行动项。",
    skills: [
      {
        id: "project-plan",
        name: "项目计划生成",
        description: "按目标和截止时间生成阶段计划",
        standardQuestion:
          "请根据目标“【项目目标】”和截止时间【截止时间】生成阶段计划。",
      },
      {
        id: "risk-identification",
        name: "风险识别",
        description: "识别依赖、资源和交付风险",
        standardQuestion:
          "请识别项目【项目名称】的依赖、资源和交付风险。",
      },
      {
        id: "action-breakdown",
        name: "行动项拆解",
        description: "拆解负责人、截止时间和验收标准",
        standardQuestion:
          "请将项目【项目名称】拆解为负责人、截止时间和验收标准明确的行动项。",
      },
      {
        id: "progress-tracking",
        name: "进度追踪",
        description: "汇总里程碑状态与阻塞事项",
        standardQuestion:
          "请汇总项目【项目名称】的里程碑状态和阻塞事项。",
      },
      {
        id: "project-review",
        name: "项目复盘",
        description: "沉淀结果、问题与后续改进项",
        standardQuestion:
          "请复盘项目【项目名称】的结果、问题和后续改进项。",
      },
    ],
  },
];
