import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCampaign,
  buildProjectPlan,
  diagnoseProduct,
  exportCampaignFollowups,
  queryOperationsKpis,
  scoreMerchantLeads,
} from "../lib/demo-tools";

test("queries deterministic operations metrics", () => {
  const result = queryOperationsKpis("7d");
  assert.match(result.summary, /GMV 下滑/);
  assert.equal(result.artifact.kind, "table");
  assert.equal(result.artifact.rows?.length, 4);
});

test("diagnoses a known product and rejects an unknown SKU", () => {
  const result = diagnoseProduct("SNK-2048");
  assert.match(result.summary, /复古厚底缓震运动鞋/);
  assert.throws(() => diagnoseProduct("UNKNOWN"), /未找到商品/);
});

test("filters merchant leads by score", () => {
  const result = scoreMerchantLeads(85);
  assert.equal(result.artifact.rows?.length, 2);
  assert.throws(() => scoreMerchantLeads(120), /0 到 100/);
});

test("analyzes campaign progress and exports valid CSV", () => {
  const analysis = analyzeCampaign("SUMMER-01");
  const exported = exportCampaignFollowups("SUMMER-01");
  assert.match(analysis.summary, /报名完成度/);
  assert.equal(exported.artifact.kind, "csv");
  assert.match(exported.artifact.content ?? "", /北屿运动/);
});

test("builds a bounded project plan", () => {
  const result = buildProjectPlan("8 月交易增长专项", 4);
  assert.equal(result.artifact.lines?.length, 7);
  assert.throws(() => buildProjectPlan("测试", 1), /2 到 8 周/);
});
