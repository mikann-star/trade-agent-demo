import {
  analyzeCampaign,
  buildProjectPlan,
  diagnoseProduct,
  exportCampaignFollowups,
  queryOperationsKpis,
  scoreMerchantLeads,
  type DemoArtifact,
  type DemoToolResult,
} from "./demo-tools";

export type DemoAgentKey =
  | "operations"
  | "product"
  | "merchant"
  | "campaign"
  | "project";

export type DemoStreamEvent = {
  name: string;
  data: Record<string, unknown>;
};

type AgentDefinition = {
  key: DemoAgentKey;
  name: string;
  tool: string;
  toolLabel: string;
};

type AgentResult = {
  definition: AgentDefinition;
  result?: DemoToolResult;
  extraArtifacts?: DemoArtifact[];
  error?: string;
};

const definitions: Record<DemoAgentKey, AgentDefinition> = {
  operations: {
    key: "operations",
    name: "日常运营 Agent",
    tool: "query_operations_kpis",
    toolLabel: "查询经营指标并计算环比",
  },
  product: {
    key: "product",
    name: "商品运营 Agent",
    tool: "diagnose_product",
    toolLabel: "读取商品表现并生成诊断",
  },
  merchant: {
    key: "merchant",
    name: "招商 Agent",
    tool: "score_merchant_leads",
    toolLabel: "筛选并评分招商线索",
  },
  campaign: {
    key: "campaign",
    name: "营销活动 Agent",
    tool: "analyze_campaign",
    toolLabel: "核对活动报名与审核进度",
  },
  project: {
    key: "project",
    name: "项目管理 Agent",
    tool: "build_project_plan",
    toolLabel: "拆解里程碑、行动项与风险",
  },
};

const keywordMap: Array<[DemoAgentKey, RegExp]> = [
  ["operations", /gmv|经营|流量|转化|订单|退款|访客|运营/i],
  ["product", /商品|sku|snk-|bag-|drs-|上架|趋势词|货品/i],
  ["merchant", /招商|线索|商家|入驻|潜力|品牌/i],
  ["campaign", /活动|报名|营销|summer-|清单|会场/i],
  ["project", /项目|计划|风险|行动项|里程碑|专项|周计划/i],
];

function abortError() {
  return new DOMException("演示任务已停止", "AbortError");
}

function wait(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function inferAgents(
  prompt: string,
  preferredAgent?: DemoAgentKey,
): DemoAgentKey[] {
  const strongMatches = (
    [
      ["product", /商品|sku|snk-|bag-|drs-|上架|货品/i],
      ["merchant", /招商|线索|入驻|潜力/i],
      ["campaign", /活动|报名|summer-|会场/i],
      ["project", /项目|计划|行动项|里程碑|专项/i],
    ] as Array<[DemoAgentKey, RegExp]>
  )
    .filter(([, pattern]) => pattern.test(prompt))
    .map(([key]) => key);
  const matched = keywordMap
    .filter(([, pattern]) => pattern.test(prompt))
    .map(([key]) => key);
  const inferred = strongMatches.length === 1 ? strongMatches : matched;
  const ordered = preferredAgent
    ? [preferredAgent, ...inferred.filter((key) => key !== preferredAgent)]
    : inferred;
  return [...new Set(ordered)].slice(0, 3);
}

function executeAgent(key: DemoAgentKey, prompt: string): AgentResult {
  const definition = definitions[key];
  try {
    if (key === "operations") {
      return { definition, result: queryOperationsKpis(prompt.includes("30") ? "30d" : "7d") };
    }
    if (key === "product") {
      const sku = prompt.match(/\b(?:SNK|BAG|DRS)-\d{4}\b/i)?.[0] ?? "SNK-2048";
      return { definition, result: diagnoseProduct(sku) };
    }
    if (key === "merchant") {
      const threshold = Number(prompt.match(/(?:潜力分|评分|分数)[^\d]*(\d{2,3})/)?.[1] ?? 80);
      return { definition, result: scoreMerchantLeads(threshold) };
    }
    if (key === "campaign") {
      const result = analyzeCampaign("SUMMER-01");
      const extraArtifacts = /导出|清单|csv/i.test(prompt)
        ? [exportCampaignFollowups("SUMMER-01").artifact]
        : undefined;
      return { definition, result, extraArtifacts };
    }
    const weeks = Math.min(
      8,
      Math.max(2, Number(prompt.match(/(\d)\s*周/)?.[1] ?? 4)),
    );
    return {
      definition,
      result: buildProjectPlan(
        prompt.match(/(?:为|制定)(.+?)(?:制定|生成|拆解|\d\s*周|项目计划)/)?.[1]?.trim() ||
          "8 月交易增长专项",
        weeks,
      ),
    };
  } catch (error) {
    return {
      definition,
      error: error instanceof Error ? error.message : "演示工具执行失败",
    };
  }
}

function buildAnswer(results: AgentResult[]) {
  const completed = results.filter((item) => item.result);
  const failed = results.filter((item) => item.error);
  if (!completed.length) {
    return `我已定位到相关领域，但演示工具没有返回可用结果。\n\n${failed
      .map((item) => `- ${item.definition.name}：${item.error}`)
      .join("\n")}\n\n请检查商品编号或换一个示例问题重试。`;
  }

  const sections = completed.map((item, index) => {
    const evidence = item.result?.evidence
      .slice(0, 4)
      .map((line) => `- ${line}`)
      .join("\n");
    return `${index + 1}. ${item.definition.name}\n${item.result?.summary}\n${evidence}`;
  });
  const action =
    completed.length > 1
      ? "建议先处理共同影响最大的流量与供给问题，再按右侧生成物逐项推进。"
      : "建议从右侧生成物中的第一项动作开始执行，并在 3 天后复盘指标变化。";
  return `已完成分析。本次调用了 ${completed.length} 个业务 Agent，结论如下：\n\n${sections.join(
    "\n\n",
  )}\n\n下一步：${action}\n\n以上内容仅基于内置演示数据。`;
}

function chunks(text: string, size = 10) {
  const result: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    result.push(text.slice(index, index + size));
  }
  return result;
}

export async function runDemoScenario(options: {
  prompt: string;
  preferredAgent?: DemoAgentKey;
  signal: AbortSignal;
  onEvent: (event: DemoStreamEvent) => void;
  delayScale?: number;
  minimumThinkingMs?: number;
}) {
  const {
    prompt,
    preferredAgent,
    signal,
    onEvent,
    delayScale = 1,
    minimumThinkingMs = 5_000,
  } = options;
  const startedAt = performance.now();
  const pause = (ms: number) => wait(ms * delayScale, signal);
  const finishVisibleThinking = async (detail: string) => {
    onEvent({ name: "reasoning.started", data: { detail } });
    const targetDuration = minimumThinkingMs * delayScale;
    const remaining = targetDuration - (performance.now() - startedAt);
    if (remaining > 0) await wait(remaining, signal);
  };
  const selected = inferAgents(prompt, preferredAgent);

  onEvent({
    name: "run.started",
    data: { detail: "识别任务意图与所需业务能力" },
  });
  await pause(260);

  if (!selected.length) {
    await finishVisibleThinking("复核问题上下文，判断还需要补充哪些业务信息");
    const clarification =
      "我还不能确定要调用哪个业务 Agent。你可以补充一个方向：经营指标、具体商品、招商线索、营销活动，或项目计划。\n\n也可以直接点击左侧的演示任务开始体验。";
    for (const delta of chunks(clarification)) {
      onEvent({ name: "message.delta", data: { delta } });
      await pause(24);
    }
    onEvent({ name: "run.completed", data: {} });
    return;
  }

  const results: AgentResult[] = [];
  for (const key of selected) {
    const definition = definitions[key];
    onEvent({
      name: "agent.started",
      data: { name: definition.name, detail: "已接收主理人委派的子任务" },
    });
    await pause(230);
    onEvent({
      name: "tool.started",
      data: { name: definition.tool, label: definition.toolLabel },
    });
    await pause(420);

    const executed = executeAgent(key, prompt);
    results.push(executed);
    if (executed.error) {
      onEvent({
        name: "tool.failed",
        data: { name: definition.tool, message: executed.error },
      });
    } else {
      onEvent({
        name: "tool.completed",
        data: {
          name: definition.tool,
          detail: `${executed.result?.evidence.length ?? 0} 项数据证据`,
        },
      });
      const artifacts = [
        executed.result?.artifact,
        ...(executed.extraArtifacts ?? []),
      ].filter(Boolean) as DemoArtifact[];
      for (const artifact of artifacts) {
        onEvent({
          name: "artifact.ready",
          data: { artifact: { ...artifact, id: crypto.randomUUID() } },
        });
      }
    }
    onEvent({
      name: "agent.completed",
      data: {
        name: definition.name,
        detail: executed.error ? "等待补充信息" : "子任务已完成",
      },
    });
    await pause(180);
  }

  await finishVisibleThinking("交叉核验数据证据、业务结论与行动建议");

  for (const delta of chunks(buildAnswer(results))) {
    onEvent({ name: "message.delta", data: { delta } });
    await pause(22);
  }
  onEvent({ name: "run.completed", data: {} });
}
