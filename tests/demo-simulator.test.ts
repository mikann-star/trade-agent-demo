import assert from "node:assert/strict";
import test from "node:test";
import { runDemoScenario, type DemoStreamEvent } from "../lib/demo-simulator";

function browserWindowShim() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout,
      clearTimeout,
    },
  });
}

test("streams a complete single-agent demo with an artifact", async () => {
  browserWindowShim();
  const events: DemoStreamEvent[] = [];
  await runDemoScenario({
    prompt: "诊断商品 SNK-2048 的流量和转化表现",
    signal: new AbortController().signal,
    delayScale: 0,
    onEvent: (event) => events.push(event),
  });

  assert.equal(
    events.filter((event) => event.name === "agent.started").length,
    1,
  );
  assert.ok(events.some((event) => event.name === "artifact.ready"));
  assert.ok(events.some((event) => event.name === "reasoning.started"));
  assert.equal(events.at(-1)?.name, "run.completed");
});

test("limits a cross-domain task to three agents", async () => {
  browserWindowShim();
  const events: DemoStreamEvent[] = [];
  await runDemoScenario({
    prompt: "结合 GMV、商品、招商、活动和项目风险做一份计划",
    signal: new AbortController().signal,
    delayScale: 0,
    onEvent: (event) => events.push(event),
  });

  assert.equal(
    events.filter((event) => event.name === "agent.started").length,
    3,
  );
});

test("asks for clarification when no domain can be inferred", async () => {
  browserWindowShim();
  const events: DemoStreamEvent[] = [];
  await runDemoScenario({
    prompt: "帮我看看这个问题",
    signal: new AbortController().signal,
    delayScale: 0,
    onEvent: (event) => events.push(event),
  });

  const answer = events
    .filter((event) => event.name === "message.delta")
    .map((event) => String(event.data.delta))
    .join("");
  assert.match(answer, /补充一个方向/);
  assert.equal(events.at(-1)?.name, "run.completed");
});
