export type QueryType =
  | "knowledge_qa"
  | "data_query"
  | "data_analysis"
  | "task_execution";

export type AnswerAudience = "internal" | "merchant";
export type AudienceMode = AnswerAudience | "both";
export type AudienceIntent =
  | "default_internal"
  | "explicit_internal"
  | "merchant"
  | "both";
export type EvidenceVisibility = "merchant" | "internal";
export type EvidenceSource = "knowledge" | "agent";

export type AudienceEvidence = {
  id: string;
  source: EvidenceSource;
  sourceName: string;
  visibility: EvidenceVisibility;
  content: string;
};

export type PlannedAudienceAnswer = {
  slot: AnswerAudience;
  audience: AnswerAudience;
  content: string;
  usedEvidenceIds: string[];
  canDeriveMerchant: boolean;
};

export type AudienceRunPlan = {
  queryType: QueryType;
  routeName: string;
  audienceMode: AudienceMode;
  audienceIntent: AudienceIntent;
  evidence: AudienceEvidence[];
  answers: PlannedAudienceAnswer[];
  fallback?: "merchant_unavailable_prompt" | "merchant_unavailable_notice";
};

export type AudienceStreamEvent = {
  name: string;
  data: Record<string, unknown>;
};

export const audienceScenarioPrompts = [
  {
    id: "internal-derivable",
    label: "1. 用户未说明受众 + 答案生成过程中存在可对商信息",
    prompt: "请分析北屿运动近期经营问题并给出运营建议。",
  },
  {
    id: "internal-not-derivable",
    label: "2. 用户未说明受众 + 答案生成过程中不存在可对商信息",
    prompt: "请分析商家内部风险等级和平台招商优先级。",
  },
  {
    id: "explicit-internal",
    label: "3. 用户明确说明答案仅供内部使用",
    prompt: "请分析北屿运动近期经营问题并给出运营建议，仅供内部使用。",
  },
  {
    id: "merchant-direct",
    label: "4. 用户明确说明答案对商 + 答案生成过程中存在可对商信息",
    prompt: "请生成一段回复商家的活动审核进度话术。",
  },
  {
    id: "merchant-unavailable",
    label: "5. 用户明确说明答案对商 + 答案生成过程中不存在可对商信息",
    prompt: "请向商家说明其内部风险等级和平台招商优先级。",
  },
  {
    id: "both-versions",
    label:
      "6. 用户明确要求同时生成对内 + 对商答案，且答案生成过程中存在可对商信息",
    prompt: "请分别生成对运营和对商两个版本，说明活动审核结果。",
  },
  {
    id: "both-merchant-unavailable",
    label:
      "7. 用户明确要求同时生成对内 + 对商答案，但答案生成过程中不存在可对商信息",
    prompt:
      "请分别生成对运营和对商两个版本，说明商家内部风险等级和平台招商优先级。",
  },
] as const;

const knowledgeEvidence: AudienceEvidence[] = [
  {
    id: "knowledge-merchant-process",
    source: "knowledge",
    sourceName: "商家端知识库",
    visibility: "merchant",
    content: "活动审核结果可在商家后台“活动报名”页面查看。",
  },
  {
    id: "knowledge-merchant-materials",
    source: "knowledge",
    sourceName: "商家端知识库",
    visibility: "merchant",
    content: "资料不完整时，商家可按页面提示补充库存证明和活动价。",
  },
  {
    id: "knowledge-internal-review",
    source: "knowledge",
    sourceName: "运营知识库",
    visibility: "internal",
    content: "高潜商家的审核问题应由运营在两个工作日内优先跟进。",
  },
];

const agentEvidence: AudienceEvidence[] = [
  {
    id: "agent-merchant-status",
    source: "agent",
    sourceName: "营销活动 Agent",
    visibility: "merchant",
    content: "北屿运动当前审核状态为待补充库存证明。",
  },
  {
    id: "agent-merchant-action",
    source: "agent",
    sourceName: "营销活动 Agent",
    visibility: "merchant",
    content: "商家可在 8 月 15 日 18:00 前补交材料，提交后重新进入审核。",
  },
  {
    id: "agent-internal-risk",
    source: "agent",
    sourceName: "招商 Agent",
    visibility: "internal",
    content: "该商家内部风险等级为 B，近期履约稳定性需要持续观察。",
  },
  {
    id: "agent-internal-priority",
    source: "agent",
    sourceName: "招商 Agent",
    visibility: "internal",
    content: "该商家平台招商优先级为 P1，建议运营优先人工跟进。",
  },
];

const internalOnlyEvidence = agentEvidence.filter(
  (item) => item.visibility === "internal",
);

const queryLabels: Record<QueryType, string> = {
  knowledge_qa: "知识库检索",
  data_query: "数据查询 Agent",
  data_analysis: "数据分析 Agent",
  task_execution: "任务执行 Agent",
};

export function detectQueryType(prompt: string): QueryType {
  if (/执行|导出|生成清单|制定计划|创建任务/u.test(prompt)) {
    return "task_execution";
  }
  if (/分析|诊断|趋势|原因|建议|风险|优先级/u.test(prompt)) {
    return "data_analysis";
  }
  if (/查询|多少|指标|数据|进度|记录|结果/u.test(prompt)) {
    return "data_query";
  }
  return "knowledge_qa";
}

export function detectAudienceMode(prompt: string): AudienceMode {
  const intent = detectAudienceIntent(prompt);
  return intent === "default_internal" || intent === "explicit_internal"
    ? "internal"
    : intent;
}

export function detectAudienceIntent(prompt: string): AudienceIntent {
  if (
    /两版|两个版本|分别生成/u.test(prompt) ||
    /同时.{0,12}(?:对内|运营).{0,12}(?:对商|商家)|同时.{0,12}(?:对商|商家).{0,12}(?:对内|运营)/u.test(
      prompt,
    )
  ) {
    return "both";
  }
  if (/回复商家|商家话术|对商|给商家|向商家|商家回复/u.test(prompt)) {
    return "merchant";
  }
  if (/仅供内部|只供内部|仅内部使用|内部参考|仅供运营|仅供公司/u.test(prompt)) {
    return "explicit_internal";
  }
  return "default_internal";
}

export function selectEvidence(prompt: string, queryType: QueryType) {
  if (/内部风险等级|平台招商优先级|仅含内部|仅内部信息/u.test(prompt)) {
    return internalOnlyEvidence.map((item) => ({ ...item }));
  }
  return (queryType === "knowledge_qa" ? knowledgeEvidence : agentEvidence).map(
    (item) => ({ ...item }),
  );
}

export function filterEvidenceForAudience(
  evidence: AudienceEvidence[],
  audience: AnswerAudience,
) {
  return audience === "merchant"
    ? evidence.filter((item) => item.visibility === "merchant")
    : evidence;
}

export function buildAnswerFromEvidence(
  audience: AnswerAudience,
  evidence: AudienceEvidence[],
) {
  const allowedEvidence = filterEvidenceForAudience(evidence, audience);
  if (!allowedEvidence.length) return null;

  const evidenceLines = allowedEvidence
    .map((item) => `- ${item.content}`)
    .join("\n");
  if (audience === "merchant") {
    return `您好，关于本次事项，现将可向您同步的信息整理如下：\n\n${evidenceLines}\n\n如您完成材料补充，我们会继续跟进后续审核进度。`;
  }
  return `内部结论：本次已结合完整运营可见信息完成判断。\n\n${evidenceLines}\n\n运营建议：优先处理商家可执行事项，同时结合内部风险和优先级安排跟进节奏。`;
}

function planAnswer(
  audience: AnswerAudience,
  evidence: AudienceEvidence[],
  canDeriveMerchant: boolean,
): PlannedAudienceAnswer | null {
  const allowedEvidence = filterEvidenceForAudience(evidence, audience);
  const content = buildAnswerFromEvidence(audience, evidence);
  if (!content) return null;
  return {
    slot: audience,
    audience,
    content,
    usedEvidenceIds: allowedEvidence.map((item) => item.id),
    canDeriveMerchant,
  };
}

export function createAudienceRunPlan(prompt: string): AudienceRunPlan {
  const queryType = detectQueryType(prompt);
  const audienceIntent = detectAudienceIntent(prompt);
  const audienceMode: AudienceMode =
    audienceIntent === "default_internal" || audienceIntent === "explicit_internal"
      ? "internal"
      : audienceIntent;
  const evidence = selectEvidence(prompt, queryType);
  const hasMerchantEvidence = evidence.some(
    (item) => item.visibility === "merchant",
  );
  const routeName = queryLabels[queryType];

  if (audienceMode === "merchant" && !hasMerchantEvidence) {
    return {
      queryType,
      routeName,
      audienceMode,
      audienceIntent,
      evidence,
      answers: [],
      fallback: "merchant_unavailable_prompt",
    };
  }

  if (audienceMode === "both") {
    return {
      queryType,
      routeName,
      audienceMode,
      audienceIntent,
      evidence,
      answers: [
        planAnswer("internal", evidence, false),
        planAnswer("merchant", evidence, false),
      ].filter((item): item is PlannedAudienceAnswer => Boolean(item)),
      fallback: hasMerchantEvidence
        ? undefined
        : "merchant_unavailable_notice",
    };
  }

  const answer = planAnswer(
    audienceMode,
    evidence,
    audienceIntent === "default_internal" && hasMerchantEvidence,
  );
  return {
    queryType,
    routeName,
    audienceMode,
    audienceIntent,
    evidence,
    answers: answer ? [answer] : [],
  };
}

export function canDeriveMerchantVersion(
  usedEvidenceIds: string[],
  evidence: AudienceEvidence[],
) {
  const used = new Set(usedEvidenceIds);
  return evidence.some(
    (item) => item.visibility === "merchant" && used.has(item.id),
  );
}

export function merchantUnavailableMessage(
  fallback: AudienceRunPlan["fallback"] = "merchant_unavailable_prompt",
) {
  return fallback === "merchant_unavailable_notice"
    ? "当前暂无可用于生成对商版本的信息源"
    : "当前暂无可用于生成对商版本的信息源。是否需要生成一份对内版本供内部参考？";
}

function abortError() {
  return new DOMException("演示任务已停止", "AbortError");
}

function wait(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function chunks(text: string, size = 11) {
  const result: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    result.push(text.slice(index, index + size));
  }
  return result;
}

export async function runAudienceIsolationScenario(options: {
  plan: AudienceRunPlan;
  signal: AbortSignal;
  onEvent: (event: AudienceStreamEvent) => void;
  delayScale?: number;
  minimumThinkingMs?: number;
}) {
  const {
    plan,
    signal,
    onEvent,
    delayScale = 1,
    minimumThinkingMs = 2_800,
  } = options;
  const startedAt = performance.now();
  const pause = (ms: number) => wait(ms * delayScale, signal);
  const merchantCount = plan.evidence.filter(
    (item) => item.visibility === "merchant",
  ).length;
  const internalCount = plan.evidence.length - merchantCount;

  onEvent({
    name: "run.started",
    data: { detail: "识别 Query 类型与目标能力" },
  });
  await pause(220);
  onEvent({
    name: "route.completed",
    data: {
      queryType: plan.queryType,
      routeName: plan.routeName,
      detail: `识别为${plan.queryType === "knowledge_qa" ? "知识问答" : "非知识问答"}，路由至${plan.routeName}`,
    },
  });
  await pause(360);
  onEvent({
    name: "visibility.completed",
    data: {
      merchantCount,
      internalCount,
      detail: `上游返回 ${plan.evidence.length} 条信息：可对商 ${merchantCount} 条、仅对内 ${internalCount} 条`,
    },
  });
  await pause(300);
  onEvent({
    name: "audience.detected",
    data: {
      audienceMode: plan.audienceMode,
      audienceIntent: plan.audienceIntent,
      detail:
        plan.audienceMode === "both"
          ? "用户明确要求同时生成对内与对商两个版本"
          : plan.audienceMode === "merchant"
            ? "用户明确要求生成对商版本"
            : plan.audienceIntent === "explicit_internal"
              ? "用户明确要求答案仅供内部使用"
              : "未明确要求对商，默认面向内部运营",
    },
  });

  const remaining = minimumThinkingMs * delayScale - (performance.now() - startedAt);
  if (remaining > 0) await wait(remaining, signal);
  onEvent({
    name: "reasoning.started",
    data: { detail: "按受众隔离允许进入答案上下文的信息" },
  });

  const streamUnavailable = async () => {
    if (!plan.fallback) return;
    onEvent({
      name: "answer.started",
      data: {
        slot: "fallback",
        fallback: plan.fallback,
        evidence: plan.evidence,
        audienceIntent: plan.audienceIntent,
      },
    });
    for (const delta of chunks(merchantUnavailableMessage(plan.fallback))) {
      onEvent({ name: "message.delta", data: { slot: "fallback", delta } });
      await pause(25);
    }
    onEvent({ name: "answer.completed", data: { slot: "fallback" } });
  };

  if (plan.fallback && !plan.answers.length) {
    await streamUnavailable();
    onEvent({ name: "run.completed", data: {} });
    return;
  }

  for (const answer of plan.answers) {
    onEvent({
      name: "answer.started",
      data: {
        slot: answer.slot,
        audience: answer.audience,
        evidence: plan.evidence,
        usedEvidenceIds: answer.usedEvidenceIds,
        canDeriveMerchant: answer.canDeriveMerchant,
        audienceIntent: plan.audienceIntent,
      },
    });
    for (const delta of chunks(answer.content)) {
      onEvent({
        name: "message.delta",
        data: { slot: answer.slot, audience: answer.audience, delta },
      });
      await pause(22);
    }
    onEvent({
      name: "answer.completed",
      data: { slot: answer.slot, audience: answer.audience },
    });
    await pause(120);
  }
  await streamUnavailable();
  onEvent({ name: "run.completed", data: {} });
}

export async function streamAudienceAnswer(options: {
  audience: AnswerAudience;
  evidence: AudienceEvidence[];
  signal: AbortSignal;
  onDelta: (delta: string) => void;
  delayScale?: number;
}) {
  const {
    audience,
    evidence,
    signal,
    onDelta,
    delayScale = 1,
  } = options;
  const answer = buildAnswerFromEvidence(audience, evidence);
  if (!answer) throw new Error("当前没有可用于生成该受众版本的信息");
  await wait(650 * delayScale, signal);
  for (const delta of chunks(answer)) {
    onDelta(delta);
    await wait(22 * delayScale, signal);
  }
  return answer;
}
