import {
  merchantOperationAgents,
  quickComposerExperts,
  type SceneDefinition,
  type SubAgentDefinition,
} from "./agent-skill-catalog";

export type HomeFunctionCategoryId =
  | "recommended"
  | "merchant"
  | "product"
  | "project"
  | "other";

export interface HomeFunctionDefinition {
  id: string;
  name: string;
  description: string;
  standardQuestion: string;
}

export const homeFunctionCategories: Array<{
  id: HomeFunctionCategoryId;
  label: string;
}> = [
  { id: "recommended", label: "为你推荐" },
  { id: "merchant", label: "商家运营" },
  { id: "product", label: "商品运营" },
  { id: "project", label: "项目管理" },
  { id: "other", label: "其他场景" },
];

const functions = {
  dataQuery: {
    id: "data-query",
    name: "数据查询",
    description:
      "支持查询订单、履约物流、支付、质检、预约单、商品、采购及销售库存等交易业务信息，可通过订单号、运单号、SKU/SPU ID、预约单号等业务标识快速获取对应明细，覆盖订单、商品、库存、预约取件等常见交易查询场景",
    standardQuestion: "帮我查一下SKU【请填写】的商品基础信息",
  },
  bidPermissionDiagnosis: {
    id: "bid-permission-diagnosis",
    name: "出价权限诊断",
    description:
      "查询指定卖家在指定商品上的出价权限，判断各类出价方式是否可用，并从商品渠道限制、商家权限与资质、指定卖家范围等维度分析不可出价原因；必要时进一步核查商家资质有效期、品牌直发权限等信息，并结合 SOP 给出对应的排查和处理建议。",
    standardQuestion:
      "帮我查一下卖家【请填写商家ID】在商品【请填写SPUID】上为什么不能出价",
  },
  businessDiagnosis: {
    id: "business-diagnosis",
    name: "业务诊断",
    description:
      "支持租赁、履约、国补、退运补贴、预约单、服务标、跨境进出口、时效等交易业务的查询与问题诊断，可根据用户描述自动识别业务场景，分析订单明细、履约状态、补贴情况、服务标覆盖、预约取件、跨境订单及晚到必赔规则命中等问题。",
    standardQuestion:
      "帮我看看这笔订单出了什么问题，订单号是 【请填写订单号】",
  },
  mrdWriting: {
    id: "mrd-writing",
    name: "MRD撰写",
    description:
      "辅助完成需求背景、价值、功能详情、协同方等内容的识别和深挖，撰写MRD文档。",
    standardQuestion:
      "请为我写一份MRD，我的需求如下：\n1.需求名称\n2.需求背景\n3.需求价值\n4.需求详情",
  },
  internetResearch: {
    id: "internet-research",
    name: "外网信息查询",
    description:
      "支持检索公开互联网信息，包括官网、新闻资讯、行业媒体、公开报告、小红书等外部信息源，可用于查询最新行业动态、竞品信息、品牌与商品资料、市场趋势及公开规则政策等内容，并对多来源信息进行整理汇总，提供对应的信息来源供进一步核实。",
    standardQuestion:
      "帮我查一下最近户外用品行业有哪些值得关注的新动态，并附上信息来源",
  },
  priceCompetitiveness: {
    id: "price-competitiveness",
    name: "价格力分析",
    description:
      "分析指定商品或品类在特定时间段内的价格竞争力表现，定位价格异常、重点问题及影响原因，并给出可执行优化建议。",
    standardQuestion:
      "帮我分析下 SPU【请填写SPUID】在【请填写时间范围】的价格力表现",
  },
  productDiagnosis: {
    id: "product-diagnosis",
    name: "单品诊断",
    description:
      "针对单个商品进行经营表现诊断，分析指定周期内的 GMV、订单量及价格竞争力等核心表现，并从供给、库存、SKU、商家、营销活动等维度逐层下钻异动原因，定位具体异常 SKU 和关键影响因素，最终输出综合诊断结论及可执行的优化建议。",
    standardQuestion:
      "帮我分析一下 SPU【请填写SPUID】 在【请填写时间范围】的 GMV 表现，看看主要问题出在哪里，并给出优化建议",
  },
  opportunityInsight: {
    id: "opportunity-insight",
    name: "商机洞察",
    description:
      "专注于低效query分析、新增趋势词分析、捞月集创建和查询、相似趋势词查询、电商机会词（趋势词）、全网机会商品、全网机会品牌、雷达搬运AI发品相关信息查询和数据分析。",
    standardQuestion: "分析管理二级类目【请填写管二类目名称】新增趋势词",
  },
  productDetailDiagnosis: {
    id: "product-detail-diagnosis",
    name: "商详内容诊断",
    description:
      "面向得物商品详情页的内容质量诊断，支持对比品牌官网、旗舰店等外部信息，识别货号、版本、配件、工艺等内容缺失，同时检查现有商详的内容合规性与阅读体验，并输出有依据、可直接补充或修改的优化建议。",
    standardQuestion:
      "帮我诊断一下商品【请填写商品ID】的商品详情页，看看有哪些内容缺失或需要修改，并给出优化建议",
  },
  requirementProcess: {
    id: "requirement-process",
    name: "提需流程答疑",
    description:
      "查询各版本信息&里程碑日期、提需资格、日常迭代/独立项目提需流程、RDC提报入口等提需信息",
    standardQuestion: "帮我查询【请填写版本号】版本我的需求进展",
  },
  rdcSubmission: {
    id: "rdc-submission",
    name: "RDC提报",
    description: "依据需求文档链接及任务提示词，自动在RDC系统提报MRD/PRD。",
    standardQuestion:
      "帮我在RDC上的【请填写项目名称】【请填写版本号】提报一个MRD/PRD【请填写MRD/PRD文档链接】",
  },
  peopleMap: {
    id: "people-map",
    name: "找人地图",
    description: "通过得物各部门的找人地图找人",
    standardQuestion: "我想【请填写诉求】，请根据找人地图帮我找对接人",
  },
  securityService: {
    id: "security-service",
    name: "安全服务",
    description: "解答安全技术/信息安全/数据安全等相关问题",
    standardQuestion: "哪些纯个人文件可以直接外发？需要报备吗？",
  },
  permissionService: {
    id: "permission-service",
    name: "权限服务",
    description:
      "支持ACL、天网、权限中心的系统权限的申请、查询与管理，可根据业务场景推荐适合申请的系统和权限，查询个人已有权限及可访问菜单，参考同部门同事的权限配置进行申请，并支持查询系统管理员、查看审批进度及撤回审批等操作。",
    standardQuestion: "帮我查询下我在智能运营系统里有哪些权限",
  },
} satisfies Record<string, HomeFunctionDefinition>;

const homeFunctionsByCategory: Record<
  HomeFunctionCategoryId,
  HomeFunctionDefinition[]
> = {
  recommended: [
    functions.dataQuery,
    functions.bidPermissionDiagnosis,
    functions.businessDiagnosis,
    functions.mrdWriting,
    functions.internetResearch,
  ],
  merchant: [
    functions.dataQuery,
    functions.businessDiagnosis,
    functions.priceCompetitiveness,
    functions.productDiagnosis,
    functions.bidPermissionDiagnosis,
  ],
  product: [functions.opportunityInsight, functions.productDetailDiagnosis],
  project: [
    functions.mrdWriting,
    functions.requirementProcess,
    functions.rdcSubmission,
  ],
  other: [
    functions.peopleMap,
    functions.internetResearch,
    functions.securityService,
    functions.permissionService,
  ],
};

export function getHomeCategoryFunctions(
  categoryId: HomeFunctionCategoryId,
): HomeFunctionDefinition[] {
  return homeFunctionsByCategory[categoryId];
}

export function getHomeSuggestedQuestions(
  categoryId: HomeFunctionCategoryId = "recommended",
): HomeFunctionDefinition[] {
  return getHomeCategoryFunctions(categoryId);
}

export function getHomeCategoryTargetScene(
  categoryId: HomeFunctionCategoryId,
): SceneDefinition["id"] | null {
  if (categoryId === "other") return null;
  return categoryId === "recommended" ? "merchant" : categoryId;
}

const frequentExpertIds = [
  "merchant-operation-agent",
  "data-analysis-agent",
  "ab-analysis-agent",
  "deposit-agent",
  "trade-data-query",
] as const;

const allHomeExperts = Array.from(
  new Map(
    [...merchantOperationAgents, ...quickComposerExperts].map((agent) => [
      agent.id,
      agent,
    ]),
  ).values(),
);

function requireExpert(expertId: string): SubAgentDefinition {
  const expert = allHomeExperts.find((agent) => agent.id === expertId);
  if (!expert) throw new Error(`Missing home expert: ${expertId}`);
  return expert;
}

export const frequentHomeExperts = frequentExpertIds.map(requireExpert);

export function getHomeExpertById(
  expertId: string | undefined,
): SubAgentDefinition | undefined {
  if (!expertId) return undefined;
  return allHomeExperts.find((agent) => agent.id === expertId);
}

export type ExpertComposerSelectionAction =
  | "fill_expert_question"
  | "preserve_text"
  | "preserve_compatible_skill"
  | "remove_incompatible_skill";

export function getExpertComposerSelectionAction({
  expertId,
  input,
  selectedSkillExpertId,
}: {
  expertId: string;
  input: string;
  selectedSkillExpertId?: string;
}): ExpertComposerSelectionAction {
  if (selectedSkillExpertId) {
    return selectedSkillExpertId === expertId
      ? "preserve_compatible_skill"
      : "remove_incompatible_skill";
  }
  return input.trim() ? "preserve_text" : "fill_expert_question";
}
