import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestionSuggestions,
  type QuestionSuggestionSource,
} from "../lib/question-suggestions";

const sources: QuestionSuggestionSource[] = [
  {
    key: "merchant:qualification",
    name: "商家资质查询",
    description: "查询资质是否过期、出价权限和品牌直发资格等",
    standardQuestion:
      "请查询商家【商家ID】的资质是否过期、出价权限和品牌直发资格。",
    expertLabel: "商家专家",
  },
  {
    key: "merchant:violation",
    name: "商家违规单查询",
    description: "查询指定商家的违规处罚记录",
    standardQuestion: "请查询商家【商家ID】的违规处罚记录。",
    expertLabel: "商家专家",
  },
  {
    key: "product:trend",
    name: "趋势词挖掘",
    description: "分析搜索趋势和内容热度",
    standardQuestion: "请分析【时间范围】内的商品搜索趋势词和机会方向。",
    expertLabel: "商品专家",
  },
];

test("waits for two normalized characters before suggesting", () => {
  assert.deepEqual(getQuestionSuggestions("商", sources), []);
  assert.deepEqual(getQuestionSuggestions("  商  ", sources), []);
  assert.ok(getQuestionSuggestions("商家", sources).length > 0);
});

test("matches titles, questions, descriptions and related keywords", () => {
  assert.equal(getQuestionSuggestions("商家资质", sources)[0]?.id, "merchant:qualification");
  assert.equal(getQuestionSuggestions("违规处罚", sources)[0]?.id, "merchant:violation");
  assert.equal(getQuestionSuggestions("商品搜索趋势", sources)[0]?.id, "product:trend");
  assert.equal(getQuestionSuggestions("怎么查询商家资质", sources)[0]?.id, "merchant:qualification");
});

test("uses match priority, stable catalog order and a five-item limit", () => {
  const tieredSources: QuestionSuggestionSource[] = [
    {
      ...sources[0],
      key: "description-match",
      name: "经营诊断",
      description: "支持资质检查",
      standardQuestion: "请诊断商家经营情况。",
    },
    {
      ...sources[0],
      key: "question-match",
      name: "经营查询",
      description: "查询经营信息",
      standardQuestion: "请完成资质检查。",
    },
    {
      ...sources[0],
      key: "title-match",
      name: "资质检查",
      description: "查询经营信息",
      standardQuestion: "请检查商家经营信息。",
    },
  ];
  assert.deepEqual(
    getQuestionSuggestions("资质", tieredSources).map(
      (suggestion) => suggestion.id,
    ),
    ["title-match", "question-match", "description-match"],
  );

  const repeated = Array.from({ length: 7 }, (_, index) => ({
    ...sources[0],
    key: `merchant:${index}`,
    name: `商家查询${index}`,
    standardQuestion: `请查询商家【商家ID-${index}】的经营信息。`,
  }));
  const suggestions = getQuestionSuggestions("商家", repeated);
  assert.equal(suggestions.length, 5);
  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.id),
    repeated.slice(0, 5).map((source) => source.key),
  );
});

test("does not repeat the exact question or duplicate questions", () => {
  const duplicate = { ...sources[0], key: "merchant:qualification-copy" };
  assert.equal(
    getQuestionSuggestions("资质", [sources[0], duplicate]).length,
    1,
  );
  assert.ok(
    getQuestionSuggestions(sources[0].standardQuestion, sources).every(
      (suggestion) => suggestion.id !== sources[0].key,
    ),
  );
});
