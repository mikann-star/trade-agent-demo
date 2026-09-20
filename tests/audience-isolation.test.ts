import assert from "node:assert/strict";
import test from "node:test";
import {
  audienceScenarioPrompts,
  buildAnswerFromEvidence,
  canDeriveMerchantVersion,
  createAudienceRunPlan,
  detectAudienceIntent,
  detectAudienceMode,
  detectQueryType,
  filterEvidenceForAudience,
  merchantUnavailableMessage,
} from "../lib/audience-isolation";

test("routes four query types and defaults the audience to internal", () => {
  assert.equal(detectQueryType("活动规则是什么"), "knowledge_qa");
  assert.equal(detectQueryType("查询活动审核进度"), "data_query");
  assert.equal(detectQueryType("分析商家经营风险"), "data_analysis");
  assert.equal(detectQueryType("导出待跟进清单"), "task_execution");
  assert.equal(detectAudienceMode("分析经营问题"), "internal");
  assert.equal(detectAudienceMode("生成回复商家的话术"), "merchant");
  assert.equal(detectAudienceMode("分别生成对运营和对商两个版本"), "both");
  assert.equal(detectAudienceIntent("分析经营问题"), "default_internal");
  assert.equal(
    detectAudienceIntent("分析经营问题，仅供内部使用"),
    "explicit_internal",
  );
});

test("merchant answers never receive internal evidence", () => {
  const plan = createAudienceRunPlan(
    "请分别生成对运营和对商两个版本，说明活动审核结果。",
  );
  const merchantEvidence = filterEvidenceForAudience(plan.evidence, "merchant");
  assert.ok(merchantEvidence.length > 0);
  assert.ok(merchantEvidence.every((item) => item.visibility === "merchant"));

  const merchantAnswer = plan.answers.find(
    (answer) => answer.audience === "merchant",
  );
  const internalContents = plan.evidence
    .filter((item) => item.visibility === "internal")
    .map((item) => item.content);
  assert.ok(merchantAnswer);
  assert.ok(
    internalContents.every((content) => !merchantAnswer.content.includes(content)),
  );
});

test("degrades explicit merchant requests without merchant-visible evidence", () => {
  const plan = createAudienceRunPlan(
    "请向商家说明其内部风险等级和平台招商优先级。",
  );
  assert.equal(plan.audienceMode, "merchant");
  assert.equal(plan.fallback, "merchant_unavailable_prompt");
  assert.deepEqual(plan.answers, []);
  assert.equal(buildAnswerFromEvidence("merchant", plan.evidence), null);
});

test("derivation eligibility depends on evidence actually used", () => {
  const plan = createAudienceRunPlan("请分析北屿运动近期经营问题并给出建议。");
  const internalAnswer = plan.answers[0];
  assert.equal(internalAnswer.audience, "internal");
  assert.equal(
    canDeriveMerchantVersion(internalAnswer.usedEvidenceIds, plan.evidence),
    true,
  );
  assert.equal(
    canDeriveMerchantVersion(
      plan.evidence
        .filter((item) => item.visibility === "internal")
        .map((item) => item.id),
      plan.evidence,
    ),
    false,
  );
});

test("both mode plans two independently scoped answers", () => {
  const plan = createAudienceRunPlan(
    "请分别生成对运营和对商两个版本，说明活动审核结果。",
  );
  assert.deepEqual(
    plan.answers.map((answer) => answer.audience),
    ["internal", "merchant"],
  );
  assert.ok(plan.answers.every((answer) => !answer.canDeriveMerchant));
});

test("covers all seven audience interaction scenarios", () => {
  assert.deepEqual(
    audienceScenarioPrompts.map((scenario) => scenario.label),
    [
      "1. 用户未说明受众 + 答案生成过程中存在可对商信息",
      "2. 用户未说明受众 + 答案生成过程中不存在可对商信息",
      "3. 用户明确说明答案仅供内部使用",
      "4. 用户明确说明答案对商 + 答案生成过程中存在可对商信息",
      "5. 用户明确说明答案对商 + 答案生成过程中不存在可对商信息",
      "6. 用户明确要求同时生成对内 + 对商答案，且答案生成过程中存在可对商信息",
      "7. 用户明确要求同时生成对内 + 对商答案，但答案生成过程中不存在可对商信息",
    ],
  );

  const plans = audienceScenarioPrompts.map((scenario) =>
    createAudienceRunPlan(scenario.prompt),
  );
  assert.equal(plans[0].answers[0].canDeriveMerchant, true);
  assert.equal(plans[1].answers[0].canDeriveMerchant, false);
  assert.equal(plans[1].fallback, undefined);
  assert.equal(plans[2].audienceIntent, "explicit_internal");
  assert.equal(plans[2].answers[0].canDeriveMerchant, false);
  assert.deepEqual(plans[3].answers.map((answer) => answer.audience), [
    "merchant",
  ]);
  assert.equal(plans[4].fallback, "merchant_unavailable_prompt");
  assert.deepEqual(plans[5].answers.map((answer) => answer.audience), [
    "internal",
    "merchant",
  ]);
  assert.deepEqual(plans[6].answers.map((answer) => answer.audience), [
    "internal",
  ]);
  assert.equal(plans[6].fallback, "merchant_unavailable_notice");
});

test("standardized audience notices do not end with a full stop", () => {
  assert.equal(
    merchantUnavailableMessage("merchant_unavailable_notice"),
    "当前暂无可用于生成对商版本的信息源",
  );
  assert.ok(
    !merchantUnavailableMessage("merchant_unavailable_notice").endsWith("。"),
  );
});
