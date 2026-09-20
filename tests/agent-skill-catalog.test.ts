import assert from "node:assert/strict";
import test from "node:test";
import {
  agentSkillCatalogSource,
  getSceneStats,
  merchantOperationAgents,
  quickComposerExperts,
  sceneCatalog,
} from "../lib/agent-skill-catalog";

test("uses the latest Feishu catalog snapshot", () => {
  assert.deepEqual(agentSkillCatalogSource, {
    sheet: "AGENT&SKILL介绍",
    range: "A1:M72",
    revision: 849,
    rawSkillMountCount: 47,
    excludedMissingQuestionCount: 0,
    visibleSkillMountCount: 47,
  });
});

test("maps source agents to five scenes and marks previews as coming soon", () => {
  assert.deepEqual(
    sceneCatalog.map((scene) => [scene.id, scene.name]),
    [
      ["merchant", "商家运营"],
      ["campaign", "营销"],
      ["project", "需求管理"],
      ["product", "商品"],
      ["acquisition", "招商"],
    ],
  );
  assert.deepEqual(
    sceneCatalog.map((scene) => [scene.id, scene.status]),
    [
      ["merchant", "available"],
      ["campaign", "coming-soon"],
      ["project", "available"],
      ["product", "available"],
      ["acquisition", "coming-soon"],
    ],
  );
});

test("preserves all non-bidding experts and usable skill mounts", () => {
  const stats = Object.fromEntries(
    sceneCatalog.map((scene) => [scene.id, getSceneStats(scene)]),
  );

  assert.deepEqual(stats, {
    merchant: { expertCount: 12, skillCount: 40 },
    campaign: { expertCount: 3, skillCount: 4 },
    project: { expertCount: 4, skillCount: 3 },
    product: { expertCount: 5, skillCount: 0 },
    acquisition: { expertCount: 4, skillCount: 0 },
  });
  assert.equal(
    sceneCatalog.reduce((total, scene) => total + scene.agents.length, 0),
    28,
  );
  assert.equal(
    sceneCatalog.reduce(
      (total, scene) => total + getSceneStats(scene).skillCount,
      0,
    ),
    47,
  );
  assert.ok(
    sceneCatalog.every((scene) =>
      scene.agents.every((agent) => agent.id !== "price-operation-agent"),
    ),
  );
});

test("keeps source order, repeated mounts and empty experts", () => {
  assert.deepEqual(
    merchantOperationAgents.slice(0, 5).map((agent) => agent.name),
    [
      "商家运营专家",
      "商品经营分析专家",
      "AB 实验专家",
      "寄存业务专家",
      "交易实时查询专家",
    ],
  );

  const merchantMounts = merchantOperationAgents.flatMap(
    (agent) => agent.skills,
  );
  assert.equal(
    merchantMounts.filter((skill) => skill.id === "dewu-trade-api-invoke")
      .length,
    2,
  );
  assert.equal(new Set(merchantMounts.map((skill) => skill.mountKey)).size, 40);
  assert.deepEqual(
    merchantOperationAgents
      .filter((agent) => agent.skills.length === 0)
      .map((agent) => agent.name),
    ["安全服务专家", "权限服务专家"],
  );
});

test("keeps coming-soon marketing skills without enabling them", () => {
  const allSkills = sceneCatalog.flatMap((scene) =>
    scene.agents.flatMap((agent) => agent.skills),
  );
  const comingSoonSkillIds = [
    "activity-robot-command",
    "brand-new-user-gift-qa",
    "supply-coupon-qa",
    "platform-promotion-activity-qa",
  ];

  const comingSoonSkills = allSkills.filter((skill) =>
    comingSoonSkillIds.includes(skill.id),
  );

  assert.deepEqual(
    comingSoonSkills.map((skill) => skill.id),
    comingSoonSkillIds,
  );
  assert.ok(
    comingSoonSkills.every(
      (skill) =>
        skill.standardQuestion === "" && skill.availability === "coming-soon",
    ),
  );
  assert.deepEqual(
    comingSoonSkills.map((skill) => [skill.name, skill.description]),
    [
      [
        "活动助手查询用法",
        "作为营销招商活动查询 MCP 使用的说明 SKILL，主要说明接口在不同场景下的入参用法",
      ],
      [
        "品牌首单礼金招商QA问题知识库",
        "前期以SKILL形式实现的“知识库”，后期迁移到交易知识库中",
      ],
      [
        "平商共补券招商QA问题知识库",
        "前期以SKILL形式实现的“知识库”，后期迁移到交易知识库中",
      ],
      [
        "平台大促活动招商QA问题知识库",
        "前期以SKILL形式实现的“知识库”，后期迁移到交易知识库中",
      ],
    ],
  );
  assert.ok(
    allSkills
      .filter((skill) => !comingSoonSkillIds.includes(skill.id))
      .every((skill) => skill.standardQuestion.length > 0),
  );
  assert.equal(
    allSkills.find((skill) => skill.id === "find-user-fallback")
      ?.standardQuestion,
    "根据找人地图，帮我找",
  );
});

test("keeps acquisition experts visible while their skills are pending", () => {
  const acquisitionScene = sceneCatalog.find(
    (scene) => scene.id === "acquisition",
  );
  assert.ok(acquisitionScene);
  assert.equal(acquisitionScene.status, "coming-soon");
  assert.equal(acquisitionScene.agents.length, 4);
  assert.ok(acquisitionScene.agents.every((agent) => agent.skills.length === 0));
});

test("splits requirement-management skills and keeps them under the source expert", () => {
  const requirementScene = sceneCatalog.find((scene) => scene.id === "project");
  assert.ok(requirementScene);
  assert.deepEqual(
    requirementScene.agents.map((agent) => [
      agent.name,
      agent.skills.map((skill) => skill.name),
    ]),
    [
      ["PRD撰写专家", []],
      ["MRD撰写专家", ["MRD需求提案建档", "MRD需求澄清", "MRD文档生成"]],
      ["提需流程答疑专家", []],
      ["RDC提报专家", []],
    ],
  );
});

test("keeps the homepage compatibility experts backed by source data", () => {
  assert.deepEqual(
    quickComposerExperts.map((agent) => agent.name),
    ["商家运营专家", "营销招商活动助手", "MRD撰写专家", "商品运营专家"],
  );
  assert.ok(quickComposerExperts.every((agent) => agent.standardQuestion));
});
