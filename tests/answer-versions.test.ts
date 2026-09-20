import assert from "node:assert/strict";
import test from "node:test";
import { getFavoriteAnswers } from "../lib/task-history";
import {
  beginProgressQuery, completeAnswerHistory, createAnswerHistory,
  failProgressQuery, latestAnswerVersion, receiveProgressQuery,
  selectAnswerVersion, selectedAnswerVersion, stopAnswerHistory,
  type AnswerSnapshot,
} from "../lib/answer-versions";

const snapshot = (content: string): AnswerSnapshot => ({
  content,
  elapsedMs: 2_500,
  trace: [{ id: "step", title: "分析商品表现", detail: "处理中", status: "running" }],
});

test("a new turn starts at preview 1 and completion pushes the final without a pull", () => {
  const initial = createAnswerHistory("run-a", 1_000);
  assert.equal(selectedAnswerVersion(initial).number, 1);
  const completed = completeAnswerHistory(initial, snapshot("完整结论"), 5_000);
  assert.equal(completed.status, "completed");
  assert.equal(selectedAnswerVersion(completed).kind, "final");
  assert.equal(selectedAnswerVersion(completed).content, "完整结论");
  assert.equal(completed.versions.length, 2);
  assert.equal(completed.versions[1].createdAt, 5_000);
  assert.equal(beginProgressQuery(completed, snapshot("进度"), "q", 6_000), undefined);
});

test("pulls create immutable, increasing previews and block duplicate clicks", () => {
  const source = snapshot("第一阶段结论");
  const first = beginProgressQuery(createAnswerHistory("run-a", 0), source, "q1", 2_500)!;
  assert.equal(beginProgressQuery(first.history, source, "double-click", 2_501), undefined);
  source.content = "随后流式生成的新内容";
  source.trace[0].status = "completed";
  const second = receiveProgressQuery(first.history, first.request, 4_300);
  assert.equal(selectedAnswerVersion(second).number, 2);
  assert.equal(selectedAnswerVersion(second).content, "第一阶段结论");
  assert.equal(selectedAnswerVersion(second).trace[0].status, "running");
  assert.equal(selectedAnswerVersion(second).createdAt, 2_500);
  assert.equal(selectedAnswerVersion(second).receivedAt, 4_300);
  const third = beginProgressQuery(second, snapshot("第二阶段"), "q2", 5_000)!;
  const result = receiveProgressQuery(third.history, third.request, 6_800);
  assert.equal(selectedAnswerVersion(result).number, 3);
  assert.equal(result.versions.length, 3);
});

test("a late pull remains a preview and never replaces the pushed final", () => {
  const pull = beginProgressQuery(createAnswerHistory("run-a", 0), snapshot("中间进度"), "q1", 2_000)!;
  const completed = completeAnswerHistory(pull.history, snapshot("最终结论"), 2_500);
  assert.equal(completed.pendingRequestId, "q1");
  const result = receiveProgressQuery(completed, pull.request, 3_800);
  assert.equal(result.versions.length, 3);
  assert.equal(selectedAnswerVersion(result).kind, "final");
  assert.equal(selectedAnswerVersion(result).content, "最终结论");
  assert.equal(result.pendingRequestId, undefined);
  const historical = selectAnswerVersion(result, pull.request.version.id);
  assert.equal(selectedAnswerVersion(historical).kind, "preview");
  assert.equal(selectedAnswerVersion(historical).content, "中间进度");
  assert.equal(latestAnswerVersion(historical).content, "最终结论");
  assert.equal(receiveProgressQuery(result, pull.request, 4_000), result);
});

test("a final push overrides a manually selected older preview; history remains browsable", () => {
  const initial = createAnswerHistory("run-a", 0);
  const pull = beginProgressQuery(initial, snapshot("进度"), "q1", 2_000)!;
  const queried = receiveProgressQuery(pull.history, pull.request, 3_800);
  const oldSelection = selectAnswerVersion(queried, initial.selectedId);
  assert.equal(selectedAnswerVersion(oldSelection).number, 1);
  const final = completeAnswerHistory(oldSelection, snapshot("最终结果"), 5_000);
  assert.equal(selectedAnswerVersion(final).kind, "final");
  assert.equal(selectedAnswerVersion(selectAnswerVersion(final, initial.selectedId)).number, 1);
  assert.equal(completeAnswerHistory(final, snapshot("重复推送"), 6_000), final);
});

test("stopping during a query preserves previews, clears busy state and rejects late results", () => {
  const pull = beginProgressQuery(createAnswerHistory("run-a", 0), snapshot("进度"), "q1", 2_000)!;
  const stopped = stopAnswerHistory(pull.history, "stopped");
  assert.equal(stopped.pendingRequestId, undefined);
  assert.equal(stopped.versions.length, 1);
  assert.equal(receiveProgressQuery(stopped, pull.request, 3_800), stopped);
  assert.equal(completeAnswerHistory(stopped, snapshot("晚到结果"), 4_000), stopped);
});

test("failed pulls clear busy state, preserve versions and allow retry without a fake final", () => {
  const pull = beginProgressQuery(createAnswerHistory("run-a", 0), snapshot("进度"), "q1", 2_000)!;
  const failed = failProgressQuery(pull.history, pull.request);
  assert.equal(failed.status, "running");
  assert.ok(failed.queryError);
  assert.equal(failed.versions.length, 1);
  const retry = beginProgressQuery(failed, snapshot("重试结果"), "q2", 4_000)!;
  assert.equal(retry.history.queryError, undefined);
  assert.equal(receiveProgressQuery(retry.history, pull.request, 4_500), retry.history);
  assert.equal(selectedAnswerVersion(receiveProgressQuery(retry.history, retry.request, 5_800)).content, "重试结果");
});

test("responses are scoped to their own turn even when another conversation is active", () => {
  const first = beginProgressQuery(createAnswerHistory("run-a", 0), snapshot("A 的进度"), "q1", 2_000)!;
  const second = beginProgressQuery(createAnswerHistory("run-b", 1_000), snapshot("B 的进度"), "q2", 2_000)!;
  assert.equal(receiveProgressQuery(second.history, first.request, 3_800), second.history);
  assert.equal(selectedAnswerVersion(receiveProgressQuery(first.history, first.request, 3_800)).content, "A 的进度");
  assert.equal(selectedAnswerVersion(receiveProgressQuery(second.history, second.request, 3_800)).content, "B 的进度");
});

test("final snapshots do not mutate when the stream or trace object changes", () => {
  const source = snapshot("最终结论");
  const final = completeAnswerHistory(createAnswerHistory("run-a", 0), source, 4_000);
  source.trace[0].detail = "不应污染历史";
  source.content = "新内容";
  assert.equal(selectedAnswerVersion(final).trace[0].detail, "处理中");
  assert.equal(selectedAnswerVersion(final).content, "最终结论");
  assert.equal(selectAnswerVersion(final, "missing-id"), final);
});

test("regenerating an older answer keeps its original query even after later questions", () => {
  const [favorite] = getFavoriteAnswers([{
    id: "conversation", title: "任务", icon: "folder", metadata: "", createdAt: 0, updatedAt: 5_000,
    messages: [
      { id: "query-a", role: "user", content: "原始问题 A\n保留完整内容" },
      { id: "answer-a", role: "assistant", content: "第一次回答" },
      { id: "query-b", role: "user", content: "后续问题 B" },
      { id: "answer-b", role: "assistant", content: "后续回答" },
      { id: "regenerated-a", role: "assistant", content: "A 的重新生成结果", queryMessageId: "query-a", favorited: true },
    ],
  }]);
  assert.equal(favorite.question, "原始问题 A\n保留完整内容");
});
