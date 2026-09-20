import type {
  AnswerAudience,
  AudienceEvidence,
  AudienceIntent,
  QueryType,
} from "./audience-isolation";

export type TaskTraceStep = {
  id: string;
  title: string;
  detail: string;
  status: "running" | "completed";
};

export type TaskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  answeringAgent?: TaskTargetAgent;
  pending?: boolean;
  elapsedMs?: number;
  trace?: TaskTraceStep[];
  favorited?: boolean;
  audience?: AnswerAudience;
  audienceIntent?: AudienceIntent;
  queryType?: QueryType;
  evidence?: AudienceEvidence[];
  usedEvidenceIds?: string[];
  canDeriveMerchant?: boolean;
  derivedFromId?: string;
  derivedAnswerId?: string;
  answerGroupId?: string;
  sourceAnswerId?: string;
  fallback?:
    | "merchant_unavailable_prompt"
    | "merchant_unavailable_notice";
};

export type RecentTask = {
  id: string;
  title: string;
  metadata: string;
  icon: "folder" | "project";
  messages: TaskMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  archived?: boolean;
  status?: "running" | "completed";
  startedAt?: number;
  unreadCompletion?: boolean;
  favorited?: boolean;
  targetAgent?: TaskTargetAgent;
};

export type TaskTargetAgent = {
  id: string;
  name: string;
};

export type FavoriteAnswer = {
  taskId: string;
  taskTitle: string;
  question: string;
  message: TaskMessage;
};

export type TaskActivityIndicator = "spinner" | "attention" | "time";

export function getTaskActivityIndicator(
  task: RecentTask,
  isViewing: boolean,
): TaskActivityIndicator {
  if (task.status === "running") {
    return "spinner";
  }
  return task.unreadCompletion && !isViewing ? "attention" : "time";
}

const initialTaskTime = new Date("2026-08-03T06:00:00.000Z").getTime();

export const initialRecentTasks: RecentTask[] = [
  {
    id: "preset-bid-limits",
    title: "出价上下限",
    metadata: "2026-07-29 10:20",
    icon: "folder",
    createdAt: initialTaskTime - 2 * 60 * 60 * 1_000,
    updatedAt: initialTaskTime - 60 * 60 * 1_000,
    messages: [
      {
        id: "preset-bid-limits-user",
        role: "user",
        content: "请帮我梳理活动商品的出价上下限规则。",
      },
      {
        id: "preset-bid-limits-assistant",
        role: "assistant",
        elapsedMs: 5_000,
        trace: [
          {
            id: "preset-route-merchant-operations",
            title: "已路由至商家运营专家",
            detail: "识别为出价规则与经营诊断问题，选择商家运营领域处理。",
            status: "completed",
          },
          {
            id: "preset-skill-bid-range",
            title: "调用 Skill：出价上下限查询",
            detail: "读取演示规则中的最低获客成本、目标毛利和风控边界。",
            status: "completed",
          },
          {
            id: "preset-analyse-performance",
            title: "分析商品转化表现",
            detail: "结合高、低转化商品的演示数据，生成分层调整建议。",
            status: "completed",
          },
          {
            id: "preset-compose-answer",
            title: "汇总规则与行动建议",
            detail: "将查询结果整理为可直接用于运营决策的结论。",
            status: "completed",
          },
        ],
        content:
          "已基于演示规则完成梳理：建议最低出价覆盖基础获客成本，最高出价不超过目标毛利可承受范围；对高转化商品可上浮 10%，低转化商品应先优化素材与详情页，再逐步调整出价。",
      },
    ],
  },
  {
    id: "preset-feishu-title",
    title: "飞书机器人默认标题",
    metadata: "2026-07-29 14:00",
    icon: "project",
    createdAt: initialTaskTime - 5 * 24 * 60 * 60 * 1_000,
    updatedAt: initialTaskTime - 4 * 24 * 60 * 60 * 1_000,
    messages: [
      {
        id: "preset-feishu-title-user",
        role: "user",
        content: "飞书机器人创建任务时，默认标题应该如何生成？",
      },
      {
        id: "preset-feishu-title-assistant",
        role: "assistant",
        content:
          "默认标题建议优先取用户请求的首句，并去除无意义前缀、换行和多余标点；标题超过 28 个字符时截断并补充省略号。无法提取有效文本时，可回退为“新建交易任务”。",
      },
    ],
  },
];

export function filterRecentTasks(
  tasks: RecentTask[],
  rawQuery: string,
): RecentTask[] {
  const query = rawQuery.trim().toLocaleLowerCase("zh-CN");
  const visibleTasks = tasks
    .filter((task) => !task.archived)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  if (!query) return visibleTasks;

  return visibleTasks.filter((task) =>
    `${task.title} ${formatTaskTimestamp(new Date(task.createdAt))}`
      .toLocaleLowerCase("zh-CN")
      .includes(query),
  );
}

export function prependRecentTask(
  tasks: RecentTask[],
  task: RecentTask,
): RecentTask[] {
  return [task, ...tasks.filter((item) => item.id !== task.id)];
}

export function getFavoriteTasks(tasks: RecentTask[]): RecentTask[] {
  return tasks.filter((task) => task.favorited && !task.archived);
}

export function getFavoriteAnswers(tasks: RecentTask[]): FavoriteAnswer[] {
  return tasks
    .filter((task) => !task.archived)
    .flatMap((task) =>
      task.messages.flatMap((message, messageIndex) => {
        if (message.role !== "assistant" || !message.favorited) return [];

        const precedingQuestion = task.messages
          .slice(0, messageIndex)
          .toReversed()
          .find((candidate) => candidate.role === "user");

        return [
          {
            taskId: task.id,
            taskTitle: task.title,
            question: precedingQuestion?.content ?? "未找到关联问题",
            message,
          },
        ];
      }),
    );
}

export function createTaskTitle(prompt: string, maxLength = 28): string {
  const title = prompt.replace(/\s+/g, " ").trim() || "新建交易任务";
  return title.length > maxLength ? `${title.slice(0, maxLength)}…` : title;
}

export function formatTaskTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function restoreArchivedTask(
  tasks: RecentTask[],
  taskId: string,
  restoredAt = Date.now(),
): RecentTask[] {
  const task = tasks.find((item) => item.id === taskId);
  if (!task?.archived) return tasks;
  return prependRecentTask(tasks, {
    ...task,
    archived: false,
    pinned: false,
    updatedAt: restoredAt,
    metadata: formatTaskTimestamp(new Date(restoredAt)),
  });
}

export function formatRelativeTaskTime(
  updatedAt: number,
  now = Date.now(),
): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - updatedAt) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes}分钟前`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}小时前`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}天前`;
}

export function recoverPersistedTasks(value: unknown): RecentTask[] {
  if (!Array.isArray(value)) return initialRecentTasks;
  const tasks = value.filter(
    (item): item is RecentTask =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          typeof item.id === "string" &&
          "title" in item &&
          typeof item.title === "string" &&
          "messages" in item &&
          Array.isArray(item.messages),
      ),
  );
  if (!tasks.length) return initialRecentTasks;

  return tasks.map((task) => {
    const messages = task.messages.map((message) => {
      const legacyFallback = (message as { fallback?: string }).fallback;
      return legacyFallback === "merchant_unavailable"
        ? { ...message, fallback: "merchant_unavailable_prompt" as const }
        : message;
    });
    if (task.status !== "running") return { ...task, messages };
    return {
      ...task,
      status: undefined,
      startedAt: undefined,
      metadata: "已中断",
      unreadCompletion: false,
      messages: messages.map((message) =>
        message.pending
          ? {
              ...message,
              pending: false,
              content: message.content || "任务已因页面刷新中断，请重新生成。",
              trace: message.trace?.map((step) => ({
                ...step,
                status: "completed" as const,
              })),
            }
          : message,
      ),
    };
  });
}
