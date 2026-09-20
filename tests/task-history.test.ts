import assert from "node:assert/strict";
import test from "node:test";
import {
  filterRecentTasks,
  formatRelativeTaskTime,
  formatTaskTimestamp,
  getFavoriteAnswers,
  getFavoriteTasks,
  getTaskActivityIndicator,
  initialRecentTasks,
  prependRecentTask,
  recoverPersistedTasks,
  restoreArchivedTask,
  type RecentTask,
} from "../lib/task-history";

test("filters recent tasks by title and creation time", () => {
  assert.deepEqual(
    filterRecentTasks(initialRecentTasks, "出价").map((task) => task.id),
    ["preset-bid-limits"],
  );
  const creationTime = formatTaskTimestamp(
    new Date(initialRecentTasks[1].createdAt),
  );
  assert.deepEqual(
    filterRecentTasks(initialRecentTasks, creationTime).map((task) => task.id),
    ["preset-feishu-title"],
  );
  assert.deepEqual(filterRecentTasks(initialRecentTasks, "新手指引"), []);
});

test("search includes pinned tasks and sorts all results by last update", () => {
  const tasks: RecentTask[] = [
    { ...initialRecentTasks[1], pinned: true },
    { ...initialRecentTasks[0], pinned: false },
  ];

  assert.deepEqual(
    filterRecentTasks(tasks, "").map((task) => task.id),
    ["preset-bid-limits", "preset-feishu-title"],
  );
});

test("hides archived favorites until their task is restored", () => {
  const tasks: RecentTask[] = [
    {
      ...initialRecentTasks[0],
      archived: true,
      favorited: true,
      messages: initialRecentTasks[0].messages.map((message) =>
        message.role === "assistant" ? { ...message, favorited: true } : message,
      ),
    },
    initialRecentTasks[1],
  ];

  assert.equal(tasks[0].favorited, true);
  assert.deepEqual(getFavoriteTasks(tasks), []);
  assert.deepEqual(getFavoriteAnswers(tasks), []);

  const restored = restoreArchivedTask(tasks, "preset-bid-limits", Date.now());
  assert.deepEqual(getFavoriteTasks(restored).map((task) => task.id), [
    "preset-bid-limits",
  ]);
  assert.deepEqual(
    getFavoriteAnswers(restored).map((answer) => answer.message.id),
    ["preset-bid-limits-assistant"],
  );
});

test("favorite answers include their nearest preceding user question", () => {
  const task: RecentTask = {
    ...initialRecentTasks[0],
    messages: [
      { id: "question-one", role: "user", content: "第一个问题" },
      { id: "answer-one", role: "assistant", content: "第一个答案" },
      { id: "question-two", role: "user", content: "第二个问题" },
      {
        id: "answer-two",
        role: "assistant",
        content: "第二个答案",
        favorited: true,
      },
    ],
  };

  const [favorite] = getFavoriteAnswers([task]);
  assert.equal(favorite.taskTitle, task.title);
  assert.equal(favorite.question, "第二个问题");
  assert.equal(favorite.message.content, "第二个答案");
});

test("restores an archived task to the top without pinning it", () => {
  const restoredAt = new Date("2026-08-03T12:00:00+08:00").getTime();
  const archived = initialRecentTasks.map((task, index) =>
    index === 1 ? { ...task, archived: true, pinned: true } : task,
  );
  const restored = restoreArchivedTask(
    archived,
    "preset-feishu-title",
    restoredAt,
  );

  assert.equal(restored[0].id, "preset-feishu-title");
  assert.equal(restored[0].archived, false);
  assert.equal(restored[0].pinned, false);
  assert.equal(restored[0].updatedAt, restoredAt);
});

test("derives sidebar activity from task status and current view", () => {
  const task: RecentTask = {
    ...initialRecentTasks[0],
    status: "running",
  };
  assert.equal(getTaskActivityIndicator(task, true), "spinner");
  assert.equal(getTaskActivityIndicator(task, false), "spinner");
  assert.equal(
    getTaskActivityIndicator(
      { ...task, status: "completed", unreadCompletion: true },
      false,
    ),
    "attention",
  );
  assert.equal(
    getTaskActivityIndicator(
      { ...task, status: "completed", unreadCompletion: true },
      true,
    ),
    "time",
  );
  assert.equal(
    getTaskActivityIndicator(
      { ...task, status: "completed", unreadCompletion: false },
      false,
    ),
    "time",
  );
});

test("returns all tasks for a blank query and none for no match", () => {
  assert.equal(filterRecentTasks(initialRecentTasks, "   ").length, 2);
  assert.deepEqual(filterRecentTasks(initialRecentTasks, "不存在的任务"), []);
});

test("excludes archived tasks from blank and matched searches", () => {
  const archivedTasks = initialRecentTasks.map((task, index) =>
    index === 0 ? { ...task, archived: true } : task,
  );

  assert.deepEqual(
    filterRecentTasks(archivedTasks, "").map((task) => task.id),
    ["preset-feishu-title"],
  );
  assert.deepEqual(filterRecentTasks(archivedTasks, "出价"), []);
});

test("prepends a completed task and replaces a duplicate id", () => {
  const task: RecentTask = {
    id: "preset-bid-limits",
    title: "更新后的任务",
    metadata: "2026-07-30 10:30",
    icon: "folder",
    messages: [],
    createdAt: new Date("2026-07-30T09:30:00+08:00").getTime(),
    updatedAt: new Date("2026-07-30T10:30:00+08:00").getTime(),
    status: "completed",
  };
  const result = prependRecentTask(initialRecentTasks, task);

  assert.equal(result[0].title, "更新后的任务");
  assert.equal(result.length, initialRecentTasks.length);
  assert.equal(result.filter((item) => item.id === task.id).length, 1);
  assert.equal(result[0].status, "completed");
});

test("formats relative task time without calendar noise", () => {
  const now = new Date("2026-08-03T12:00:00+08:00").getTime();
  assert.equal(formatRelativeTaskTime(now - 20_000, now), "刚刚");
  assert.equal(formatRelativeTaskTime(now - 12 * 60_000, now), "12分钟前");
  assert.equal(formatRelativeTaskTime(now - 3 * 60 * 60_000, now), "3小时前");
  assert.equal(
    formatRelativeTaskTime(now - 4 * 24 * 60 * 60_000, now),
    "4天前",
  );
});

test("recovers persisted audience metadata and stops interrupted runs", () => {
  const runningTask: RecentTask = {
    ...initialRecentTasks[0],
    status: "running",
    startedAt: Date.now(),
    messages: [
      {
        id: "audience-answer",
        role: "assistant",
        content: "",
        pending: true,
        audience: "merchant",
        derivedFromId: "internal-answer",
      },
    ],
  };
  const [recovered] = recoverPersistedTasks([runningTask]);
  assert.equal(recovered.status, undefined);
  assert.equal(recovered.metadata, "已中断");
  assert.equal(recovered.messages[0].pending, false);
  assert.equal(recovered.messages[0].audience, "merchant");
  assert.equal(recovered.messages[0].derivedFromId, "internal-answer");
});

test("keeps a task-level explicit expert selection", () => {
  const task: RecentTask = {
    ...initialRecentTasks[0],
    targetAgent: {
      id: "merchant-operation-agent",
      name: "商家运营专家",
    },
  };

  const recovered = recoverPersistedTasks([task]);
  assert.deepEqual(recovered[0].targetAgent, task.targetAgent);
});

test("keeps the answering expert snapshot on assistant messages", () => {
  const answeringAgent = {
    id: "merchant-operation-agent",
    name: "商家运营专家",
  };
  const task: RecentTask = {
    ...initialRecentTasks[0],
    messages: [
      {
        id: "expert-answer",
        role: "assistant",
        content: "专家回答",
        answeringAgent,
        elapsedMs: 10_000,
      },
    ],
  };

  const recovered = recoverPersistedTasks([task]);
  assert.deepEqual(recovered[0].messages[0].answeringAgent, answeringAgent);
});

test("migrates the legacy merchant-unavailable status", () => {
  const legacyTask = {
    ...initialRecentTasks[0],
    messages: [
      {
        id: "legacy-fallback",
        role: "assistant" as const,
        content: "当前暂无可用于生成对商版本的信息。",
        fallback: "merchant_unavailable",
      },
    ],
  };
  const [recovered] = recoverPersistedTasks([legacyTask]);
  assert.equal(
    recovered.messages[0].fallback,
    "merchant_unavailable_prompt",
  );
});
