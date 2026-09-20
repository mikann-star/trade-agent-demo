import assert from "node:assert/strict";
import test from "node:test";
import {
  completeFeishuExternalAction,
  initialFeishuIntegrationState,
  parseFeishuIntegrationState,
} from "../lib/feishu-integration";

test("recovers a persisted integration and resumes at authorization", () => {
  const restored = parseFeishuIntegrationState(
    JSON.stringify({
      ...initialFeishuIntegrationState,
      appId: "cli_demo_example",
      appSecret: "demo_example_secret",
    }),
  );

  assert.equal(restored.step, 2);
  assert.equal(restored.linkRevealed, true);
  assert.equal(restored.authorized, false);
});

test("creates deterministic demo credentials after returning", () => {
  const result = completeFeishuExternalAction(
    {
      ...initialFeishuIntegrationState,
      linkRevealed: true,
      pendingExternalAction: "create",
    },
    "demo-seed-2026",
  );

  assert.match(result.state.appId, /^cli_demo_/);
  assert.match(result.state.appSecret, /^demo_/);
  assert.equal(result.state.pendingExternalAction, null);
  assert.equal(result.state.step, 2);
  assert.equal(
    result.toast,
    "飞书应用创建成功，请继续开通飞书权限",
  );
});

test("marks an existing integration as authorized", () => {
  const result = completeFeishuExternalAction({
    ...initialFeishuIntegrationState,
    step: 2,
    appId: "cli_demo_example",
    appSecret: "demo_example_secret",
    pendingExternalAction: "authorize",
  });

  assert.equal(result.state.authorized, true);
  assert.equal(result.state.pendingExternalAction, null);
  assert.equal(result.toast, "飞书授权成功，完整能力已解锁");
});

test("rejects malformed persisted values", () => {
  assert.deepEqual(
    parseFeishuIntegrationState("not-json"),
    initialFeishuIntegrationState,
  );
});
