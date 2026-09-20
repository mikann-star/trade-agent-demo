import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingGuide } from "../components/marketing-guide";
import { ExpertSkillWorkspace } from "../components/expert-skill-workspace";
import { marketingGuide } from "../lib/marketing-guide";
import { sceneCatalog } from "../lib/agent-skill-catalog";

test("defines five current marketing capabilities with their actual external channels", () => {
  assert.equal(marketingGuide.sceneId, "campaign");
  assert.equal(marketingGuide.title, "营销 Agent 能帮你做什么？");
  assert.equal(
    marketingGuide.description,
    "支持报名进度管理、反向提报绿通、活动答疑、会场搭建与调优，以及活动数据查询与分析。目前需在哪吒后台或飞书群中通过机器人使用，暂不支持在交易智能助手中直接调用，具体使用方式请查看下方指南。",
  );
  assert.equal(marketingGuide.sceneLabel, "需在哪吒后台或飞书群使用");
  assert.equal(marketingGuide.documentLabel, "查看使用指南");
  assert.equal(marketingGuide.documentUrl, "https://poizon.feishu.cn/wiki/EcvlwApj4igKZzk5Nlzcvq1Ynie");
  assert.deepEqual(marketingGuide.capabilities.map(({ title, channel }) => [title, channel]), [
    ["报名进度管理", "feishu"],
    ["反向提报绿通", "feishu"],
    ["活动答疑", "feishu"],
    ["会场搭建与调优", "nezha"],
    ["活动数据查询与分析", "feishu"],
  ]);
  assert.equal(new Set(marketingGuide.capabilities.map(({ id }) => id)).size, 5);
  assert.ok(marketingGuide.capabilities.every((item) => !("standardQuestion" in item)));
  assert.equal(marketingGuide.channels.feishu.instruction, "在指南对应飞书群中 @活动小助手 使用");
  assert.equal(marketingGuide.channels.nezha.instruction, "点击哪吒后台右上角「试试AI」使用");
  assert.equal(marketingGuide.capabilities[4].description, "查询具体主活动的整体效果、主要监测和复盘指标，并提供简单分析。");
});

test("renders complete introductions in order, with no executable controls or planned capabilities", () => {
  const html = renderToStaticMarkup(createElement(MarketingGuide));
  const cards = html.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
  assert.equal(cards.length, 5);
  assert.ok(html.includes(marketingGuide.description));
  assert.doesNotMatch(html, /请根据下方标注的使用入口/);
  cards.forEach((card, index) => {
    const capability = marketingGuide.capabilities[index];
    assert.ok(card.includes(capability.title));
    assert.ok(card.includes(capability.description));
    assert.match(card, /^<article\b[^>]*><h3\b[^>]*>[^<]+<\/h3><p>[^<]+<\/p><\/article>$/);
    assert.doesNotMatch(card, /<footer\b|marketing-channel|marketing-capability-channel|飞书群机器人|@活动小助手|试试AI/);
    assert.match(card, /aria-labelledby="marketing-capability-/);
  });
  assert.doesNotMatch(html, /<button\b|<input\b|<textarea\b|使用该技能|aria-disabled|即将接入|建设中|开发中|精准圈品|深度洞察/);
  const links = html.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
  assert.equal(links.length, 1);
  assert.ok(links[0].includes(`href="${marketingGuide.documentUrl}"`));
  assert.match(links[0], /target="_blank"/);
  assert.match(links[0], /rel="noopener noreferrer"/);
  assert.match(links[0], /class="acquisition-guide-link"/);
  assert.match(links[0], /在新标签页打开/);
  for (const channel of Object.values(marketingGuide.channels)) {
    assert.ok(!html.includes(channel.instruction));
  }
});

test("marketing replaces only its directory and leaves source catalog intact", () => {
  for (const scene of sceneCatalog) {
    const html = renderToStaticMarkup(createElement(ExpertSkillWorkspace, {
      initialSceneId: scene.id,
      onUseSkill: () => assert.fail("A guide must not invoke a Skill"),
    }));
    const card = html.match(/<button\b[^>]*data-testid="scene-card-campaign"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(card);
    assert.ok(card.includes(marketingGuide.sceneLabel));
    assert.match(card, />5 类能力<\/span>/);
    assert.doesNotMatch(card, /即将接入|个专家|项技能/);
    if (scene.id === "campaign") {
      assert.match(card, /aria-pressed="true"/);
      assert.match(html, /class="marketing-guide acquisition-guide"/);
      assert.doesNotMatch(html, /agent-filter-tabs|skill-sort-tabs|skill-coming-soon-overlay|agent-empty-state|使用该技能/);
    } else {
      assert.doesNotMatch(html, /class="marketing-guide/);
    }
  }
  const campaign = sceneCatalog.find(({ id }) => id === "campaign")!;
  assert.equal(campaign.agents.length, 3);
  assert.equal(campaign.agents.flatMap(({ skills }) => skills).length, 4);
  assert.equal(campaign.status, "coming-soon");
});

test("reuses responsive theme styling and lets the external-use badge wrap", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.scene-card-marketing \.scene-external-label\s*\{[^}]*max-width: 100%;[^}]*white-space: normal;/);
  assert.match(css, /\.acquisition-capability-grid\s*\{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(min-width: 761px\)\s*\{\s*\.acquisition-capability-grid\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.acquisition-guide-link:focus-visible\s*\{[^}]*outline: 2px solid #007f80/);
  assert.doesNotMatch(css, /\.marketing-capability-channel|\.marketing-channel-label|\.marketing-capability-card/);
});
