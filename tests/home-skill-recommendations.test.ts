import assert from "node:assert/strict";
import test from "node:test";
import {
  frequentHomeExperts,
  getExpertComposerSelectionAction,
  getHomeCategoryFunctions,
  getHomeCategoryTargetScene,
  getHomeExpertById,
  getHomeSuggestedQuestions,
  homeFunctionCategories,
} from "../lib/home-skill-recommendations";

test("provides the five fixed common experts in catalog order", () => {
  assert.deepEqual(
    frequentHomeExperts.map((expert) => expert.name),
    [
      "商家运营专家",
      "商品经营分析专家",
      "AB 实验专家",
      "寄存业务专家",
      "交易实时查询专家",
    ],
  );
  assert.ok(frequentHomeExperts.every((expert) => expert.standardQuestion));
});

test("provides the exact five homepage scenes", () => {
  assert.deepEqual(
    homeFunctionCategories.map((category) => category.label),
    ["为你推荐", "商家运营", "商品运营", "项目管理", "其他场景"],
  );
});

test("maps every homepage scene to the requested functions", () => {
  const expected: Record<string, string[]> = {
    recommended: [
      "数据查询",
      "出价权限诊断",
      "业务诊断",
      "MRD撰写",
      "外网信息查询",
    ],
    merchant: [
      "数据查询",
      "业务诊断",
      "价格力分析",
      "单品诊断",
      "出价权限诊断",
    ],
    product: ["商机洞察", "商详内容诊断"],
    project: ["MRD撰写", "提需流程答疑", "RDC提报"],
    other: ["找人地图", "外网信息查询", "安全服务", "权限服务"],
  };

  for (const category of homeFunctionCategories) {
    const functions = getHomeCategoryFunctions(category.id);
    assert.deepEqual(
      functions.map((item) => item.name),
      expected[category.id],
    );
    assert.ok(functions.every((item) => item.description.length > 0));
    assert.ok(functions.every((item) => item.standardQuestion.length > 0));
    assert.deepEqual(getHomeSuggestedQuestions(category.id), functions);
  }
});

test("preserves key function copy exactly", () => {
  const merchant = getHomeCategoryFunctions("merchant");
  assert.equal(
    merchant.find((item) => item.name === "数据查询")?.standardQuestion,
    "帮我查一下SKU【请填写】的商品基础信息",
  );
  assert.equal(
    merchant.find((item) => item.name === "出价权限诊断")
      ?.standardQuestion,
    "帮我查一下卖家【请填写商家ID】在商品【请填写SPUID】上为什么不能出价",
  );
  assert.equal(
    getHomeCategoryFunctions("project").find(
      (item) => item.name === "MRD撰写",
    )?.standardQuestion,
    "请为我写一份MRD，我的需求如下：\n1.需求名称\n2.需求背景\n3.需求价值\n4.需求详情",
  );
});

test("routes more functions to the matching directory", () => {
  assert.equal(getHomeCategoryTargetScene("recommended"), "merchant");
  assert.equal(getHomeCategoryTargetScene("merchant"), "merchant");
  assert.equal(getHomeCategoryTargetScene("product"), "product");
  assert.equal(getHomeCategoryTargetScene("project"), "project");
  assert.equal(getHomeCategoryTargetScene("other"), null);
});

test("selects the correct composer action when binding an expert", () => {
  assert.equal(
    getExpertComposerSelectionAction({ expertId: "a", input: "" }),
    "fill_expert_question",
  );
  assert.equal(
    getExpertComposerSelectionAction({ expertId: "a", input: "已有问题" }),
    "preserve_text",
  );
  assert.equal(
    getExpertComposerSelectionAction({
      expertId: "a",
      input: "技能标准问",
      selectedSkillExpertId: "a",
    }),
    "preserve_compatible_skill",
  );
  assert.equal(
    getExpertComposerSelectionAction({
      expertId: "a",
      input: "技能标准问",
      selectedSkillExpertId: "b",
    }),
    "remove_incompatible_skill",
  );
  assert.equal(getHomeExpertById("merchant-operation-agent")?.name, "商家运营专家");
});
