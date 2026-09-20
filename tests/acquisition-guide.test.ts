import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcquisitionGuide } from "../components/acquisition-guide";
import { ExpertSkillWorkspace } from "../components/expert-skill-workspace";
import { acquisitionGuide } from "../lib/acquisition-guide";
import { sceneCatalog, type SceneDefinition } from "../lib/agent-skill-catalog";

function renderWorkspace(sceneId: SceneDefinition["id"]) {
  return renderToStaticMarkup(
    createElement(ExpertSkillWorkspace, {
      initialSceneId: sceneId,
      onUseSkill: () => assert.fail("Browsing a scene must not invoke a Skill"),
    }),
  );
}

function getSceneCard(html: string, sceneId: SceneDefinition["id"]) {
  const card = html.match(
    new RegExp(
      `<button\\b[^>]*data-testid="scene-card-${sceneId}"[^>]*>[\\s\\S]*?<\\/button>`,
    ),
  )?.[0];
  assert.ok(card, `The ${sceneId} scene card must remain available`);
  return card;
}

test("styles the document link as a theme-colored, wrapping action", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const link = css.match(/\.acquisition-guide-link\s*\{([^}]+)\}/)?.[1];
  assert.ok(link);
  for (const declaration of [
    "max-width: 100%", "min-height: 44px", "margin-top: 12px",
    "padding: 10px 18px", "border: 1px solid #01c1c2", "border-radius: 10px",
    "background: rgba(1, 193, 194, 0.1)", "color: #007f80",
    "font-size: 14px", "font-weight: 600", "text-decoration: none",
    "white-space: normal", "overflow-wrap: anywhere",
  ]) {
    assert.ok(link.includes(declaration), `Missing document-link style: ${declaration}`);
  }
  assert.match(css, /\.acquisition-guide-header p\s*\{[^}]*margin: 10px 0 0/);
  assert.match(css, /\.acquisition-guide-link:hover\s*\{[^}]*background: rgba\(1, 193, 194, 0\.18\)/);
  assert.match(css, /\.acquisition-guide-link:focus-visible\s*\{[^}]*outline: 2px solid #007f80/);
});

test("uses compact typography only for acquisition and marketing capability cards", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.acquisition-capability-card h3\s*\{[^}]*font-size: 14px/);
  assert.match(css, /\.acquisition-capability-card p\s*\{[^}]*font-size: 13px/);
  assert.match(css, /\.acquisition-guide-header h2\s*\{[^}]*font-size: 24px/);
  assert.match(css, /\.acquisition-guide-header p\s*\{[^}]*font-size: 14px/);
});

test("defines a separate external-use guide without creating executable Skills", () => {
  assert.equal(acquisitionGuide.sceneId, "acquisition");
  assert.equal(acquisitionGuide.title, "招商 Agent 能帮你做什么？");
  assert.equal(
    acquisitionGuide.description,
    "支持招商线索获取、商家信息采集、靶向池清洗与商家触达。目前需配合 DewuClaw 使用，暂不支持在交易智能助手中直接调用。具体使用方式请查看下方指南。",
  );
  assert.equal(acquisitionGuide.documentLabel, "查看使用指南");
  assert.equal(
    acquisitionGuide.documentUrl,
    "https://poizon.feishu.cn/wiki/V1QTwsP7AiFcdBkypVDcjTaMndb",
  );
  assert.equal(acquisitionGuide.capabilities.length, 4);
  assert.deepEqual(
    acquisitionGuide.capabilities.map((capability) => capability.title),
    ["闲鱼招商线索获取", "平台爬虫个人版", "招商靶向池清洗", "IM招商工具"],
  );
  assert.deepEqual(
    acquisitionGuide.capabilities.map((capability) => capability.description),
    [
      "按关键词批量查找闲鱼潜在商家，采集店铺、销量、粉丝及联系方式等信息，支持去重、站内消息初步触达，并将结果写入飞书表格、通知采集进度。",
      "根据淘宝店铺链接，批量采集营业执照、企业名称、统一社会信用代码、法定代表人及联系方式等商家信息，自动回写飞书表格。",
      "整合抖音、天猫、淘宝、小红书等平台的商家排名数据，结合得物品牌、类目及 GMV 数据评估招商价值，输出优先级排序和可跟进的靶向池。",
      "从飞书表格读取目标商家及话术模板，支持向闲鱼、淘宝／天猫商家发送招商邀请，并回写发送状态和失败原因。",
    ],
  );
  assert.equal(
    new Set(acquisitionGuide.capabilities.map((capability) => capability.id)).size,
    4,
  );
  assert.ok(
    acquisitionGuide.capabilities.every(
      (capability) =>
        capability.title.length > 0 &&
        capability.description.length > 0 &&
        !("standardQuestion" in capability),
    ),
  );

  const acquisition = sceneCatalog.find((scene) => scene.id === "acquisition");
  assert.ok(acquisition);
  assert.equal(acquisition.agents.length, 4);
  assert.ok(acquisition.agents.every((agent) => agent.skills.length === 0));
});

test("renders four readable capability cards and a safe document hyperlink", () => {
  const html = renderToStaticMarkup(createElement(AcquisitionGuide));
  assert.match(html, /<section\b[^>]*class="acquisition-guide"/);
  assert.equal(
    (html.match(/<article\b[^>]*class="acquisition-capability-card"/g) ?? []).length,
    4,
  );
  assert.ok(html.includes(acquisitionGuide.title));
  assert.ok(html.includes(acquisitionGuide.description));
  let previousCardIndex = -1;
  for (const capability of acquisitionGuide.capabilities) {
    const cardIndex = html.indexOf(capability.title);
    assert.ok(cardIndex > previousCardIndex, "Capability order must match the guide");
    assert.ok(html.includes(capability.description));
    previousCardIndex = cardIndex;
  }

  const link = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
  assert.equal(link.length, 1);
  assert.ok(link[0].includes(`href="${acquisitionGuide.documentUrl}"`));
  assert.match(link[0], /target="_blank"/);
  assert.match(link[0], /rel="noopener noreferrer"/);
  assert.ok(link[0].includes(acquisitionGuide.documentLabel));
  assert.doesNotMatch(html, /<button\b|<input\b|<textarea\b/);
  assert.doesNotMatch(html, /使用该技能|技能建设中|即将接入|aria-disabled="true"/);
});

test("shows the DewuClaw guide only for the acquisition scene", () => {
  const html = renderWorkspace("acquisition");
  assert.match(html, /class="acquisition-guide"/);
  assert.doesNotMatch(
    html,
    /class="agent-filter-tabs"|class="skill-sort-tabs"|class="agent-empty-state"|class="expert-directory-heading"/,
  );
  assert.doesNotMatch(html, /使用该技能|技能建设中，敬请期待/);
  const card = getSceneCard(html, "acquisition");
  assert.match(card, /aria-pressed="true"/);
  assert.match(card, />需配合 DewuClaw 使用<\/span>/);
  assert.match(card, />4 类能力<\/span>/);
  assert.doesNotMatch(card, /即将接入|个专家|项技能/);
  for (const scene of sceneCatalog) {
    getSceneCard(html, scene.id);
  }
});

test("keeps merchant Skills usable", () => {
  const merchant = renderWorkspace("merchant");
  assert.doesNotMatch(merchant, /class="acquisition-guide"/);
  assert.match(merchant, /class="agent-filter-tabs"/);
  assert.match(merchant, /class="skill-sort-tabs"/);
  assert.match(merchant, /使用该技能/);
  assert.equal((merchant.match(/<article\b/g) ?? []).length, 40);
  assert.match(getSceneCard(merchant, "merchant"), /aria-pressed="true"/);

});

test("preserves requirement-management Skills and the product empty state", () => {
  const project = renderWorkspace("project");
  assert.doesNotMatch(project, /class="acquisition-guide"/);
  assert.equal((project.match(/<article\b/g) ?? []).length, 3);
  assert.match(project, /使用该技能/);

  const product = renderWorkspace("product");
  assert.doesNotMatch(product, /class="acquisition-guide"/);
  assert.match(product, /class="agent-filter-tabs"/);
  assert.match(product, /技能建设中，敬请期待/);
  assert.doesNotMatch(product, /使用该技能/);
});
