"use client";

import {
  Archive,
  Bot,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Ellipsis,
  FilePlus2,
  ImagePlus,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ExpertSkillWorkspace } from "@/components/expert-skill-workspace";
import { FeishuIntegrationDialog } from "@/components/feishu-integration-dialog";
import type {
  AgentSkillDefinition,
  SceneDefinition,
  SubAgentDefinition,
} from "@/lib/agent-skill-catalog";
import {
  createAudienceRunPlan,
  runAudienceIsolationScenario,
  streamAudienceAnswer,
  type AnswerAudience,
  type AudienceEvidence,
  type AudienceRunPlan,
} from "@/lib/audience-isolation";
import {
  createTaskTitle,
  filterRecentTasks,
  formatRelativeTaskTime,
  formatTaskTimestamp,
  getFavoriteAnswers,
  getFavoriteTasks,
  getTaskActivityIndicator,
  prependRecentTask,
  restoreArchivedTask,
  type RecentTask,
  type TaskMessage,
  type TaskTargetAgent,
  type TaskTraceStep,
} from "@/lib/task-history";
import { ConcurrentTaskScheduler } from "@/lib/task-scheduler";
import {
  getHomeCategoryFunctions,
  getHomeCategoryTargetScene,
  getHomeSuggestedQuestions,
  homeFunctionCategories,
  type HomeFunctionCategoryId,
  type HomeFunctionDefinition,
} from "@/lib/home-skill-recommendations";
import {
  buildPromptWithSkills,
  composerSkillOptions,
  filterComposerSkills,
  type ComposerSkillOption,
} from "@/lib/composer-skills";
import {
  getQuestionSuggestions,
  type QuestionSuggestion,
} from "@/lib/question-suggestions";
import {
  getFeishuIntegrationStorageSnapshot,
  parseFeishuIntegrationState,
  subscribeToFeishuIntegration,
} from "@/lib/feishu-integration";

// 后续功能扩展会从这五类能力进入；首页先保持截图中的极简状态。
const agentCapabilities = [
  "日常运营 Agent",
  "商品运营 Agent",
  "招商 Agent",
  "营销活动 Agent",
  "项目管理 Agent",
];

const composerPlaceholder = "今天帮你做些什么？";
const feishuTryNowPrompt = "连接我的飞书，帮我梳理下这周的会议日程";

const modelOptions = [
  { id: "glm-5", label: "glm-5" },
  { id: "qwen3.5-flash", label: "qwen3.5-flash" },
  { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
  { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
  { id: "doubao-seed-2-0-lite", label: "doubao-seed-2-0-lite" },
  { id: "qwen3.6-flash", label: "qwen3.6-flash", imageUnderstanding: true },
  { id: "qwen3.7-plus", label: "qwen3.7-plus", imageUnderstanding: true },
  { id: "glm-5.2", label: "glm-5.2" },
] as const;

const feedbackReasons = [
  "不正确或不完整",
  "没有遵循我的指示",
  "偏题/超出范围",
  "丢失上下文",
  "速度慢或有故障",
  "其他",
] as const;

type ModelId = (typeof modelOptions)[number]["id"];

type WorkspaceView = "chat" | "experts";
type LibraryDialog = "favorites" | "archive";
type FeedbackMode = "answer" | "general";
type FeedbackImage = { id: string; name: string; url: string };
type ComposerHandle = {
  replaceWithSkill: (skill: ComposerSkillOption) => void;
  removeSkillTokenPreservingText: () => void;
  setText: (value: string) => void;
};
type ComposerExpertOption = TaskTargetAgent;

type PromptRunJob = {
  kind: "prompt";
  taskId: string;
  prompt: string;
  assistantId: string;
  answerGroupId: string;
  plan: AudienceRunPlan;
  targetAgent?: TaskTargetAgent;
  startedAt: number;
  controller: AbortController;
};

type AnswerRunJob = {
  kind: "answer";
  taskId: string;
  answerId: string;
  audience: AnswerAudience;
  evidence: AudienceEvidence[];
  startedAt: number;
  controller: AbortController;
};

type DemoRunJob = PromptRunJob | AnswerRunJob;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function stopTaskSnapshot(task: RecentTask): RecentTask {
  return {
    ...task,
    metadata: "已停止",
    status: undefined,
    startedAt: undefined,
    unreadCompletion: false,
    updatedAt: Date.now(),
    messages: task.messages.map((message) =>
      message.pending
        ? {
            ...message,
            pending: false,
            content: message.content || "已停止生成。",
            trace: message.trace?.map((step) => ({
              ...step,
              status: "completed" as const,
            })),
          }
        : message,
    ),
  };
}

export default function Home() {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedComposerSkills, setSelectedComposerSkills] = useState<
    ComposerSkillOption[]
  >([]);
  const [pendingComposerSkill, setPendingComposerSkill] =
    useState<ComposerSkillOption | null>(null);
  const [selectedComposerExpert, setSelectedComposerExpert] =
    useState<ComposerExpertOption | null>(null);
  const [selectedHomeSkillCategory, setSelectedHomeSkillCategory] =
    useState<HomeFunctionCategoryId>("recommended");
  const [expertWorkspaceSceneId, setExpertWorkspaceSceneId] =
    useState<SceneDefinition["id"]>("merchant");
  const [planMode, setPlanMode] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>("glm-5");
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now());
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("answer");
  const [selectedFeedbackReasons, setSelectedFeedbackReasons] = useState<
    string[]
  >([]);
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackImages, setFeedbackImages] = useState<FeedbackImage[]>([]);
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [favoriteToastOpen, setFavoriteToastOpen] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null);
  const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [feishuIntegrationOpen, setFeishuIntegrationOpen] = useState(false);
  const [libraryDialog, setLibraryDialog] = useState<LibraryDialog | null>(null);
  const [deleteConfirmationTaskId, setDeleteConfirmationTaskId] = useState<
    string | null
  >(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const activeViewRef = useRef<WorkspaceView>("chat");
  const mountedRef = useRef(true);
  const [scheduler] = useState(() => new ConcurrentTaskScheduler(3));
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackCloseRef = useRef<HTMLButtonElement | null>(null);
  const feedbackImageInputRef = useRef<HTMLInputElement | null>(null);
  const accountControlRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const libraryCloseRef = useRef<HTMLButtonElement | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const favoriteToastTimerRef = useRef<number | null>(null);
  const composerHandleRef = useRef<ComposerHandle | null>(null);

  const filteredTasks = useMemo(
    () => filterRecentTasks(recentTasks, searchQuery),
    [recentTasks, searchQuery],
  );
  const pinnedTasks = useMemo(
    () => recentTasks.filter((task) => task.pinned && !task.archived),
    [recentTasks],
  );
  const unpinnedTasks = useMemo(
    () => recentTasks.filter((task) => !task.pinned && !task.archived),
    [recentTasks],
  );
  const activeTask = useMemo(
    () => recentTasks.find((task) => task.id === activeTaskId),
    [activeTaskId, recentTasks],
  );
  const deleteConfirmationTask = useMemo(
    () =>
      recentTasks.find((task) => task.id === deleteConfirmationTaskId) ?? null,
    [deleteConfirmationTaskId, recentTasks],
  );
  const messages = useMemo(() => activeTask?.messages ?? [], [activeTask]);
  const running = activeTask?.status === "running";
  const elapsedMs = running
    ? Math.max(0, elapsedNow - (activeTask.startedAt ?? elapsedNow))
    : 0;
  const hasRunningTasks = recentTasks.some((task) => task.status === "running");
  const favoriteTasks = useMemo(
    () => getFavoriteTasks(recentTasks),
    [recentTasks],
  );
  const favoriteAnswers = useMemo(
    () => getFavoriteAnswers(recentTasks),
    [recentTasks],
  );
  const archivedTasks = useMemo(
    () => recentTasks.filter((task) => task.archived),
    [recentTasks],
  );
  const homeCategoryFunctions = useMemo(
    () => getHomeCategoryFunctions(selectedHomeSkillCategory),
    [selectedHomeSkillCategory],
  );
  const homeSuggestedQuestions = useMemo(
    () => getHomeSuggestedQuestions(selectedHomeSkillCategory),
    [selectedHomeSkillCategory],
  );
  const feishuIntegrationSnapshot = useSyncExternalStore(
    subscribeToFeishuIntegration,
    getFeishuIntegrationStorageSnapshot,
    () => null,
  );
  const feishuIntegrationAuthorized = parseFeishuIntegrationState(
    feishuIntegrationSnapshot,
  ).authorized;

  useEffect(() => {
    if (!taskMenuId) return;
    const closeTaskMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".recent-task-row")
      ) {
        setTaskMenuId(null);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTaskMenuId(null);
    };
    document.addEventListener("pointerdown", closeTaskMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeTaskMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [taskMenuId]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountControlRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        requestAnimationFrame(() => accountButtonRef.current?.focus());
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveResultIndex(0);
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  }, []);

  const openSearch = useCallback(() => {
    setMobileSidebarOpen(false);
    setSearchQuery("");
    setActiveResultIndex(0);
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const closeLibrary = useCallback(() => {
    setDeleteConfirmationTaskId(null);
    setLibraryDialog(null);
    requestAnimationFrame(() => accountButtonRef.current?.focus());
  }, []);

  const openLibrary = useCallback((dialog: LibraryDialog) => {
    setAccountMenuOpen(false);
    setLibraryDialog(dialog);
    requestAnimationFrame(() => libraryCloseRef.current?.focus());
  }, []);

  const closeDeleteConfirmation = useCallback(() => {
    setDeleteConfirmationTaskId(null);
    requestAnimationFrame(() => {
      if (deleteTriggerRef.current?.isConnected) {
        deleteTriggerRef.current.focus();
      } else {
        libraryCloseRef.current?.focus();
      }
    });
  }, []);

  const openDeleteConfirmation = (
    taskId: string,
    trigger: HTMLButtonElement,
  ) => {
    deleteTriggerRef.current = trigger;
    setDeleteConfirmationTaskId(taskId);
    requestAnimationFrame(() => deleteCancelRef.current?.focus());
  };

  const showFavoriteToast = () => {
    if (favoriteToastTimerRef.current) {
      window.clearTimeout(favoriteToastTimerRef.current);
    }
    setFavoriteToastOpen(true);
    favoriteToastTimerRef.current = window.setTimeout(() => {
      setFavoriteToastOpen(false);
      favoriteToastTimerRef.current = null;
    }, 4_000);
  };

  const startNewChat = useCallback(() => {
    setInput("");
    setSelectedComposerSkills([]);
    setPendingComposerSkill(null);
    setSelectedComposerExpert(null);
    activeTaskIdRef.current = null;
    activeViewRef.current = "chat";
    setActiveTaskId(null);
    setActiveView("chat");
    setMobileSidebarOpen(false);
  }, []);

  const useExpertSkill = useCallback(
    (agent: SubAgentDefinition, skill: AgentSkillDefinition) => {
      const composerSkill: ComposerSkillOption = {
        id: skill.id,
        key: skill.mountKey,
        name: skill.name,
        description: skill.description,
        standardQuestion: skill.standardQuestion,
        expertId: agent.id,
        expertName: agent.name,
        expertLabel: agent.name,
      };
      startNewChat();
      setPendingComposerSkill(composerSkill);
    },
    [startNewChat],
  );

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "chat" || !pendingComposerSkill) return;

    const frame = window.requestAnimationFrame(() => {
      const composer = composerHandleRef.current;
      if (!composer) return;
      composer.replaceWithSkill(pendingComposerSkill);
      setPendingComposerSkill(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, pendingComposerSkill]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({
      behavior: running ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, running]);

  useEffect(() => {
    if (!hasRunningTasks) return;
    const updateElapsed = () => setElapsedNow(Date.now());
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [hasRunningTasks]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setRelativeTimeNow(Date.now()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const updateTask = useCallback(
    (
      taskId: string,
      updater: (task: RecentTask) => RecentTask,
      promote = false,
    ) => {
      if (!mountedRef.current) return;
      setRecentTasks((current) => {
        const task = current.find((item) => item.id === taskId);
        if (!task) return current;
        const updatedTask = updater(task);
        return promote
          ? prependRecentTask(current, updatedTask)
          : current.map((item) => (item.id === taskId ? updatedTask : item));
      });
    },
    [],
  );

  const bindComposerSkill = useCallback(
    (skill: ComposerSkillOption) => {
      setSelectedComposerExpert(null);
      setSelectedComposerSkills([skill]);

      const taskId = activeTaskIdRef.current;
      if (taskId) {
        updateTask(taskId, (task) => ({ ...task, targetAgent: undefined }));
      }
    },
    [updateTask],
  );

  const executeRunJob = useCallback(
    async (job: DemoRunJob) => {
      const { taskId, controller } = job;
      let assistantTrace: TaskTraceStep[] = [];
      let traceSequence = 0;
      const startedAt = job.startedAt;
      const touchedMessageIds = new Set<string>();
      const answerIdsBySlot = new Map<string, string>();
      if (job.kind === "prompt") touchedMessageIds.add(job.assistantId);
      else touchedMessageIds.add(job.answerId);

      const updateMessage = (
        messageId: string,
        updater: (message: TaskMessage) => TaskMessage,
      ) => {
        updateTask(taskId, (task) => ({
          ...task,
          messages: task.messages.map((message) =>
            message.id === messageId ? updater(message) : message,
          ),
        }));
      };

      const appendTrace = (title: string, detail: string) => {
        if (job.kind !== "prompt") return;
        assistantTrace = [
          ...assistantTrace.map((step) => ({
            ...step,
            status: "completed" as const,
          })),
          {
            id: `${job.assistantId}-trace-${traceSequence++}`,
            title,
            detail,
            status: "running",
          },
        ];
        updateMessage(job.assistantId, (message) => ({
          ...message,
          trace: assistantTrace,
        }));
      };

      try {
        if (job.kind === "prompt") {
          await runAudienceIsolationScenario({
            plan: job.plan,
            signal: controller.signal,
            onEvent: ({ name, data }) => {
              if (controller.signal.aborted) return;
              if (name === "run.started") {
                appendTrace(
                  "判断 Query 类型",
                  String(data.detail ?? "识别问题类型与所需业务能力"),
                );
              } else if (name === "route.completed") {
                if (job.targetAgent) {
                  appendTrace(
                    `Supervisor 已路由至${job.targetAgent.name}`,
                    `按当前任务显式选择，直接调用${job.targetAgent.name}处理本轮问题。`,
                  );
                } else {
                  appendTrace(
                    `路由至 ${String(data.routeName ?? "对应上游能力")}`,
                    String(data.detail ?? "已完成 Query 路由"),
                  );
                }
              } else if (name === "visibility.completed") {
                appendTrace(
                  "读取上游可见性标记",
                  String(data.detail ?? "已获得带权限标记的信息"),
                );
              } else if (name === "audience.detected") {
                appendTrace(
                  "判断目标受众",
                  String(data.detail ?? "已确定答案受众"),
                );
              } else if (name === "reasoning.started") {
                appendTrace(
                  "隔离答案生成上下文",
                  String(data.detail ?? "仅保留当前受众允许使用的信息"),
                );
              } else if (name === "answer.started") {
                const slot = String(data.slot ?? "internal");
                const firstAnswer = answerIdsBySlot.size === 0;
                const messageId = firstAnswer ? job.assistantId : createId();
                answerIdsBySlot.set(slot, messageId);
                touchedMessageIds.add(messageId);
                const messageData: TaskMessage = {
                  id: messageId,
                  role: "assistant",
                  content: "",
                  answeringAgent: job.targetAgent,
                  pending: true,
                  trace: firstAnswer ? assistantTrace : [],
                  audience:
                    data.audience === "merchant" || data.audience === "internal"
                      ? data.audience
                      : undefined,
                  audienceIntent:
                    data.audienceIntent === "default_internal" ||
                    data.audienceIntent === "explicit_internal" ||
                    data.audienceIntent === "merchant" ||
                    data.audienceIntent === "both"
                      ? data.audienceIntent
                      : job.plan.audienceIntent,
                  queryType: job.plan.queryType,
                  evidence: Array.isArray(data.evidence)
                    ? (data.evidence as AudienceEvidence[])
                    : job.plan.evidence,
                  usedEvidenceIds: Array.isArray(data.usedEvidenceIds)
                    ? (data.usedEvidenceIds as string[])
                    : [],
                  canDeriveMerchant: Boolean(data.canDeriveMerchant),
                  answerGroupId: job.answerGroupId,
                  fallback:
                    data.fallback === "merchant_unavailable_prompt" ||
                    data.fallback === "merchant_unavailable_notice"
                      ? data.fallback
                      : undefined,
                };
                if (firstAnswer) {
                  updateMessage(messageId, (message) => ({
                    ...message,
                    ...messageData,
                  }));
                } else {
                  updateTask(taskId, (task) => ({
                    ...task,
                    messages: [...task.messages, messageData],
                  }));
                }
              } else if (name === "message.delta") {
                const slot = String(data.slot ?? "internal");
                const messageId = answerIdsBySlot.get(slot) ?? job.assistantId;
                const delta = String(data.delta ?? "");
                updateMessage(messageId, (message) => ({
                  ...message,
                  content: `${message.content}${delta}`,
                }));
              }
            },
          });
        } else {
          await streamAudienceAnswer({
            audience: job.audience,
            evidence: job.evidence,
            signal: controller.signal,
            onDelta: (delta) =>
              updateMessage(job.answerId, (message) => ({
                ...message,
                content: `${message.content}${delta}`,
              })),
          });
        }

        const completedAt = new Date();
        const finalElapsedMs = Date.now() - startedAt;
        const isViewing =
          activeViewRef.current === "chat" &&
          activeTaskIdRef.current === taskId;
        updateTask(
          taskId,
          (task) => ({
            ...task,
            metadata: formatTaskTimestamp(completedAt),
            updatedAt: completedAt.getTime(),
            status: "completed",
            startedAt: undefined,
            unreadCompletion: !isViewing,
            messages: task.messages.map((message) => {
              if (!touchedMessageIds.has(message.id)) return message;
              const internalId = answerIdsBySlot.get("internal");
              const merchantId = answerIdsBySlot.get("merchant");
              return {
                ...message,
                pending: false,
                elapsedMs: finalElapsedMs,
                trace:
                  message.id ===
                  (job.kind === "prompt" ? job.assistantId : job.answerId)
                    ? (message.trace ?? assistantTrace).map((step) => ({
                        ...step,
                        status: "completed" as const,
                      }))
                    : message.trace,
                derivedAnswerId:
                  message.id === internalId && merchantId
                    ? merchantId
                    : message.derivedAnswerId,
                derivedFromId:
                  message.id === merchantId && internalId
                    ? internalId
                    : message.derivedFromId,
              };
            }),
          }),
          true,
        );
      } catch (error) {
        const stopped =
          error instanceof DOMException && error.name === "AbortError";
        const finalElapsedMs = Date.now() - startedAt;
        const isViewing =
          activeViewRef.current === "chat" &&
          activeTaskIdRef.current === taskId;
        updateTask(
          taskId,
          (task) => ({
            ...task,
            metadata: stopped ? "已停止" : "执行失败",
            updatedAt: Date.now(),
            status: stopped ? undefined : "completed",
            startedAt: undefined,
            unreadCompletion: stopped ? false : !isViewing,
            messages: task.messages.map((message) =>
              touchedMessageIds.has(message.id)
                ? {
                    ...message,
                    pending: false,
                    content:
                      message.content ||
                      (stopped
                        ? "已停止生成。"
                        : "演示任务执行失败，请稍后重试。"),
                    elapsedMs: finalElapsedMs,
                    trace: assistantTrace.map((step) => ({
                      ...step,
                      status: "completed" as const,
                    })),
                  }
                : message,
            ),
          }),
          true,
        );
      }
    },
    [updateTask],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scheduler.cancelAll();
      if (favoriteToastTimerRef.current) {
        window.clearTimeout(favoriteToastTimerRef.current);
      }
    };
  }, [scheduler]);

  const cancelTask = useCallback(
    (taskId: string) => {
      const result = scheduler.cancel(taskId);
      if (!result) updateTask(taskId, stopTaskSnapshot);
    },
    [scheduler, updateTask],
  );

  const sendPrompt = useCallback(
    (rawPrompt: string, baseMessagesOverride?: TaskMessage[]) => {
      const prompt = rawPrompt.trim();
      if (!prompt || running) return;

      const currentTask = activeTask;
      const conversationMessages =
        baseMessagesOverride ?? currentTask?.messages ?? [];
      const taskId = currentTask?.id ?? createId();
      const assistantId = createId();
      const answerGroupId = createId();
      const plan = createAudienceRunPlan(prompt);
      const userMessage: TaskMessage = {
        id: createId(),
        role: "user",
        content: prompt,
      };
      const targetAgent = selectedComposerExpert ?? currentTask?.targetAgent;
      const pendingAssistantMessage: TaskMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        answeringAgent: targetAgent,
        pending: true,
        trace: [],
      };
      const pendingConversation = [
        ...conversationMessages,
        userMessage,
        pendingAssistantMessage,
      ];
      const submittedAt = Date.now();
      const controller = new AbortController();

      setInput("");
      activeTaskIdRef.current = taskId;
      activeViewRef.current = "chat";
      setActiveTaskId(taskId);
      setActiveView("chat");
      setRecentTasks((current) =>
        prependRecentTask(current, {
          id: taskId,
          title: currentTask?.title ?? createTaskTitle(prompt),
          metadata: "处理中",
          icon: currentTask?.icon ?? "folder",
          messages: pendingConversation,
          createdAt: currentTask?.createdAt ?? submittedAt,
          updatedAt: submittedAt,
          pinned: currentTask?.pinned,
          favorited: currentTask?.favorited,
          targetAgent,
          archived: false,
          status: "running",
          startedAt: submittedAt,
          unreadCompletion: false,
        }),
      );

      const job: DemoRunJob = {
        kind: "prompt",
        taskId,
        prompt,
        assistantId,
        answerGroupId,
        plan,
        targetAgent,
        startedAt: submittedAt,
        controller,
      };
      scheduler.enqueue({
        id: taskId,
        cancel: () => controller.abort(),
        execute: () => executeRunJob(job),
        onQueuedCancel: () => updateTask(taskId, stopTaskSnapshot),
      });
    },
    [
      activeTask,
      executeRunJob,
      running,
      scheduler,
      selectedComposerExpert,
      updateTask,
    ],
  );

  const enqueueAudienceAnswer = useCallback(
    (
      taskId: string,
      answerId: string,
      audience: AnswerAudience,
      evidence: AudienceEvidence[],
    ) => {
      const controller = new AbortController();
      const startedAt = Date.now();
      const job: AnswerRunJob = {
        kind: "answer",
        taskId,
        answerId,
        audience,
        evidence,
        startedAt,
        controller,
      };
      scheduler.enqueue({
        id: taskId,
        cancel: () => controller.abort(),
        execute: () => executeRunJob(job),
        onQueuedCancel: () => updateTask(taskId, stopTaskSnapshot),
      });
    },
    [executeRunJob, scheduler, updateTask],
  );

  const deriveMerchantVersion = useCallback(
    (sourceMessageId: string) => {
      if (!activeTask || running) return;
      const source = activeTask.messages.find(
        (message) => message.id === sourceMessageId,
      );
      const evidence = source?.evidence ?? [];
      const merchantEvidence = evidence.filter(
        (item) => item.visibility === "merchant",
      );
      if (!source || !merchantEvidence.length || source.derivedAnswerId) return;

      const answerId = createId();
      const userActionId = createId();
      const startedAt = Date.now();
      const pendingAnswer: TaskMessage = {
        id: answerId,
        role: "assistant",
        content: "",
        answeringAgent: source.answeringAgent ?? activeTask.targetAgent,
        pending: true,
        audience: "merchant",
        audienceIntent: "merchant",
        queryType: source.queryType,
        evidence,
        usedEvidenceIds: merchantEvidence.map((item) => item.id),
        canDeriveMerchant: false,
        derivedFromId: source.id,
        answerGroupId: source.answerGroupId,
        trace: [
          {
            id: `${answerId}-merchant-context`,
            title: "构建独立对商上下文",
            detail: `仅使用 ${merchantEvidence.length} 条标记为可对商的信息`,
            status: "running",
          },
        ],
      };
      updateTask(activeTask.id, (task) => ({
        ...task,
        status: "running",
        startedAt,
        metadata: "处理中",
        messages: [
          ...task.messages.map((message) =>
            message.id === source.id
              ? {
                  ...message,
                  canDeriveMerchant: false,
                  derivedAnswerId: answerId,
                }
              : message,
          ),
          {
            id: userActionId,
            role: "user",
            content: "生成对商版本",
            sourceAnswerId: source.id,
            answerGroupId: source.answerGroupId,
          },
          pendingAnswer,
        ],
      }));
      enqueueAudienceAnswer(activeTask.id, answerId, "merchant", evidence);
    },
    [activeTask, enqueueAudienceAnswer, running, updateTask],
  );

  const generateInternalFromFallback = useCallback(
    (fallbackMessageId: string) => {
      if (!activeTask || running) return;
      const source = activeTask.messages.find(
        (message) => message.id === fallbackMessageId,
      );
      const evidence = source?.evidence ?? [];
      if (!source || !evidence.length || source.derivedAnswerId) return;

      const answerId = createId();
      const userActionId = createId();
      const startedAt = Date.now();
      updateTask(activeTask.id, (task) => ({
        ...task,
        status: "running",
        startedAt,
        metadata: "处理中",
        messages: [
          ...task.messages.map((message) =>
            message.id === source.id
              ? { ...message, derivedAnswerId: answerId }
              : message,
          ),
          {
            id: userActionId,
            role: "user",
            content: "生成对内版本",
            sourceAnswerId: source.id,
            answerGroupId: source.answerGroupId,
          },
          {
            id: answerId,
            role: "assistant",
            content: "",
            answeringAgent: source.answeringAgent ?? activeTask.targetAgent,
            pending: true,
            audience: "internal",
            audienceIntent: "explicit_internal",
            queryType: source.queryType,
            evidence,
            usedEvidenceIds: evidence.map((item) => item.id),
            canDeriveMerchant: false,
            derivedFromId: source.id,
            answerGroupId: source.answerGroupId,
            trace: [
              {
                id: `${answerId}-internal-context`,
                title: "切换为对内答案",
                detail: "用户确认生成供内部运营参考的完整版本",
                status: "running",
              },
            ],
          },
        ],
      }));
      enqueueAudienceAnswer(activeTask.id, answerId, "internal", evidence);
    },
    [activeTask, enqueueAudienceAnswer, running, updateTask],
  );

  const regenerateMessage = useCallback(
    (assistantMessageId: string) => {
      if (running) return;
      const assistantIndex = messages.findIndex(
        (message) => message.id === assistantMessageId,
      );
      if (assistantIndex < 1) return;
      const sourceMessage = messages[assistantIndex];
      if (sourceMessage.audience && sourceMessage.evidence?.length && activeTask) {
        const startedAt = Date.now();
        updateTask(activeTask.id, (task) => ({
          ...task,
          status: "running",
          startedAt,
          metadata: "处理中",
          messages: task.messages.map((message) =>
            message.id === sourceMessage.id
              ? {
                  ...message,
                  content: "",
                  pending: true,
                  trace: [
                    {
                      id: `${message.id}-regenerate-${startedAt}`,
                      title: `重新生成${message.audience === "merchant" ? "对商" : "对内"}版本`,
                      detail:
                        message.audience === "merchant"
                          ? "继续仅使用可对商信息生成"
                          : "继续使用完整运营可见信息生成",
                      status: "running",
                    },
                  ],
                }
              : message,
          ),
        }));
        enqueueAudienceAnswer(
          activeTask.id,
          sourceMessage.id,
          sourceMessage.audience,
          sourceMessage.evidence,
        );
        return;
      }
      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      const sourcePrompt = messages[userIndex]?.content;
      if (!sourcePrompt || userIndex < 0) return;
      sendPrompt(sourcePrompt, messages.slice(0, userIndex));
    },
    [
      activeTask,
      enqueueAudienceAnswer,
      messages,
      running,
      sendPrompt,
      updateTask,
    ],
  );

  const closeFeedback = useCallback(() => {
    setFeedbackTargetId(null);
    setSelectedFeedbackReasons([]);
    setFeedbackDetail("");
    setFeedbackImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
  }, []);

  const openFeedback = useCallback((messageId: string) => {
    setFeedbackMode("answer");
    setFeedbackTargetId(messageId);
    setSelectedFeedbackReasons([]);
    setFeedbackDetail("");
    requestAnimationFrame(() => feedbackCloseRef.current?.focus());
  }, []);

  const addFeedbackImages = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    const remaining = Math.max(0, 6 - feedbackImages.length);
    const accepted = selected.slice(0, remaining).map((file) => ({
      id: createId(),
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setFeedbackImages((current) => [...current, ...accepted]);
    if (selected.length > remaining) {
      setFeedbackNotice("最多添加 6 张图片");
      window.setTimeout(() => setFeedbackNotice(""), 2_000);
    }
  };

  const removeFeedbackImage = (imageId: string) => {
    setFeedbackImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((image) => image.id !== imageId);
    });
  };

  const handleFeedbackKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFeedback();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitFeedback = (event: FormEvent) => {
    event.preventDefault();
    const canSubmit =
      feedbackMode === "general"
        ? Boolean(feedbackDetail.trim() || feedbackImages.length)
        : Boolean(selectedFeedbackReasons.length || feedbackDetail.trim());
    if (!canSubmit) return;
    closeFeedback();
    setFeedbackNotice("感谢反馈，我们会持续优化交易智能助手");
    window.setTimeout(() => setFeedbackNotice(""), 3_000);
  };

  const openTask = useCallback(
    (task: RecentTask) => {
      activeTaskIdRef.current = task.id;
      activeViewRef.current = "chat";
      setActiveTaskId(task.id);
      setActiveView("chat");
      updateTask(task.id, (currentTask) => ({
        ...currentTask,
        unreadCompletion: false,
      }));
      setInput("");
      setSelectedComposerSkills([]);
      setSelectedComposerExpert(task.targetAgent ?? null);
      setMobileSidebarOpen(false);
      closeSearch();
    },
    [closeSearch, updateTask],
  );

  const commitTaskRename = (taskId: string) => {
    const title = renameValue.trim();
    if (title) {
      const renamedAt = new Date().getTime();
      setRecentTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? { ...task, title, updatedAt: renamedAt }
            : task,
        ),
      );
    }
    setRenamingTaskId(null);
    setRenameValue("");
  };

  const toggleTaskPin = (taskId: string) => {
    setRecentTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, pinned: !task.pinned } : task,
      ),
    );
    setTaskMenuId(null);
  };

  const toggleTaskFavorite = (taskId: string) => {
    const addingFavorite = !recentTasks.find((task) => task.id === taskId)
      ?.favorited;
    setRecentTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, favorited: !task.favorited } : task,
      ),
    );
    setTaskMenuId(null);
    if (addingFavorite) showFavoriteToast();
  };

  const toggleAnswerFavorite = (taskId: string, messageId: string) => {
    const addingFavorite = !recentTasks
      .find((task) => task.id === taskId)
      ?.messages.find((message) => message.id === messageId)?.favorited;
    updateTask(taskId, (task) => ({
      ...task,
      messages: task.messages.map((message) =>
        message.id === messageId
          ? { ...message, favorited: !message.favorited }
          : message,
      ),
    }));
    if (addingFavorite) showFavoriteToast();
  };

  const restoreTask = (taskId: string) => {
    setRecentTasks((current) => restoreArchivedTask(current, taskId));
  };

  const deleteArchivedTask = (taskId: string) => {
    setRecentTasks((current) => current.filter((task) => task.id !== taskId));
    if (activeTaskId === taskId) {
      activeTaskIdRef.current = null;
      activeViewRef.current = "chat";
      setActiveTaskId(null);
      setActiveView("chat");
      setSelectedComposerExpert(null);
    }
    setDeleteConfirmationTaskId(null);
    requestAnimationFrame(() => libraryCloseRef.current?.focus());
  };

  const copyRequestId = async (requestId: string) => {
    await navigator.clipboard.writeText(requestId);
    setFeedbackNotice("请求 ID 已复制");
    window.setTimeout(() => setFeedbackNotice(""), 2_000);
  };

  const openTaskFromLibrary = (task: RecentTask) => {
    closeLibrary();
    openTask(task);
    window.setTimeout(() => {
      scrollEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 80);
  };

  const openFavoriteAnswer = (taskId: string, messageId: string) => {
    const task = recentTasks.find((item) => item.id === taskId);
    if (!task) return;
    closeLibrary();
    openTask(task);
    window.setTimeout(() => {
      document
        .getElementById(`message-${messageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 80);
  };

  const archiveTask = (taskId: string) => {
    const taskToArchive = recentTasks.find((task) => task.id === taskId);
    if (taskToArchive?.status === "running") cancelTask(taskId);
    const archivedAt = new Date().getTime();
    setRecentTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...(task.status === "running" ? stopTaskSnapshot(task) : task),
              archived: true,
              pinned: false,
              updatedAt: archivedAt,
              metadata: formatTaskTimestamp(new Date(archivedAt)),
            }
          : task,
      ),
    );
    setTaskMenuId(null);
    if (activeTaskId === taskId) {
      activeTaskIdRef.current = null;
      activeViewRef.current = "chat";
      setActiveTaskId(null);
      setActiveView("chat");
      setSelectedComposerExpert(null);
    }
  };

  const clearComposerExpert = useCallback(() => {
    setSelectedComposerExpert(null);
    const taskId = activeTaskIdRef.current;
    if (!taskId) return;
    updateTask(taskId, (task) => ({ ...task, targetAgent: undefined }));
  }, [updateTask]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = buildPromptWithSkills(input, selectedComposerSkills);
    if (!prompt || running) return;
    sendPrompt(prompt);
    setSelectedComposerSkills([]);
  };

  const removeComposerSkill = (skillKey: string) => {
    setSelectedComposerSkills((current) =>
      current.filter((skill) => skill.key !== skillKey),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const prompt = buildPromptWithSkills(input, selectedComposerSkills);
      if (!prompt || running) return;
      sendPrompt(prompt);
      setSelectedComposerSkills([]);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((current) =>
        filteredTasks.length
          ? Math.min(current + 1, filteredTasks.length - 1)
          : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && filteredTasks[activeResultIndex]) {
      event.preventDefault();
      openTask(filteredTasks[activeResultIndex]);
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleLibraryKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLibrary();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleDeleteConfirmationKeyDown = (
    event: KeyboardEvent<HTMLElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDeleteConfirmation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main className={`minimal-app ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Image
        alt=""
        aria-hidden="true"
        className="main-background"
        fill
        priority
        sizes="100vw"
        src="./background.svg"
      />
      <span className="sr-only">
        交易业务智能工作台，使用演示数据，支持 {agentCapabilities.join("、")}
      </span>

      <aside
        aria-label="对话导航"
        className={`minimal-sidebar ${sidebarOpen ? "open" : ""} ${
          mobileSidebarOpen ? "mobile-open" : ""
        }`}
      >
        <header className="sidebar-brand">
          {sidebarOpen ? (
            <>
              <Image
                alt="交易智能助手"
                className="sidebar-title-image"
                height={31}
                priority
                src="./sidebar-title.svg"
                width={143}
              />
              <div className="sidebar-header-actions">
                <button
                  aria-label="收起侧栏"
                  className="sidebar-toggle"
                  onClick={() => setSidebarOpen(false)}
                  type="button"
                >
                  <PanelLeftClose size={18} strokeWidth={1.8} />
                </button>
                <button
                  aria-label="搜索最近任务"
                  className="sidebar-search-button"
                  onClick={openSearch}
                  ref={searchButtonRef}
                  type="button"
                >
                  <Search size={18} strokeWidth={1.8} />
                </button>
              </div>
            </>
          ) : (
            <button
              aria-label="展开侧栏"
              className="collapsed-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <PanelLeftOpen size={19} strokeWidth={1.8} />
            </button>
          )}
        </header>

        <nav aria-label="工作台导航" className="primary-sidebar-nav">
          <button aria-label="新建任务" onClick={startNewChat} type="button">
            <Plus size={19} strokeWidth={1.8} />
            <span>新建任务</span>
          </button>
          <button
            aria-current={activeView === "experts" ? "page" : undefined}
            className={activeView === "experts" ? "active" : ""}
            onClick={() => {
              setExpertWorkspaceSceneId("merchant");
              activeViewRef.current = "experts";
              setActiveView("experts");
              setMobileSidebarOpen(false);
            }}
            type="button"
          >
            <Users size={18} strokeWidth={1.7} />
            <span>专家 · 技能</span>
          </button>
        </nav>

        {pinnedTasks.length ? (
          <SidebarTaskSection
            title="置顶任务"
            expanded={pinnedExpanded}
            onToggle={() => setPinnedExpanded((value) => !value)}
            tasks={pinnedTasks}
            {...{
              activeTaskId,
              activeView,
              relativeTimeNow,
              taskMenuId,
              renamingTaskId,
              renameValue,
              openTask,
              setTaskMenuId,
              setRenamingTaskId,
              setRenameValue,
              commitTaskRename,
              toggleTaskPin,
              toggleTaskFavorite,
              archiveTask,
            }}
          />
        ) : null}
        <SidebarTaskSection
          title="最近任务"
          expanded={recentExpanded}
          onToggle={() => setRecentExpanded((value) => !value)}
          tasks={unpinnedTasks}
          {...{
            activeTaskId,
            activeView,
            relativeTimeNow,
            taskMenuId,
            renamingTaskId,
            renameValue,
            openTask,
            setTaskMenuId,
            setRenamingTaskId,
            setRenameValue,
            commitTaskRename,
            toggleTaskPin,
            toggleTaskFavorite,
            archiveTask,
          }}
        />

        <div className="account-control" ref={accountControlRef}>
          {accountMenuOpen ? (
            <div
              aria-label="账号操作"
              className="account-drawer"
              role="menu"
            >
              <button
                onClick={() => openLibrary("favorites")}
                role="menuitem"
                type="button"
              >
                <Bookmark size={17} />
                我的收藏
              </button>
              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  setFeedbackNotice("反馈群入口为演示功能");
                  window.setTimeout(() => setFeedbackNotice(""), 3_000);
                }}
                role="menuitem"
                type="button"
              >
                <Users size={17} />
                加入反馈群
              </button>
              <button
                className="account-drawer-integration"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setFeishuIntegrationOpen(true);
                }}
                role="menuitem"
                type="button"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="feishu-authorization-icon"
                  height={17}
                  src="./feishu-line.svg"
                  width={17}
                />
                <span>飞书授权</span>
                {!feishuIntegrationAuthorized ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="feishu-integration-alert-dot"
                    />
                    <span className="sr-only">飞书授权未完成</span>
                  </>
                ) : null}
              </button>
            </div>
          ) : null}
          <button
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            className={`account-menu ${accountMenuOpen ? "open" : ""}`}
            onClick={() => {
              setTaskMenuId(null);
              setAccountMenuOpen((current) => !current);
            }}
            ref={accountButtonRef}
            type="button"
          >
            <span className="account-avatar" aria-hidden="true">
              <span>咪</span>
            </span>
            <span className="account-identity">
              <strong>哈基咪</strong>
              <small>ID: Manbo</small>
            </span>
          </button>
        </div>
      </aside>

      {sidebarOpen &&
      !feishuIntegrationAuthorized &&
      !accountMenuOpen &&
      !feishuIntegrationOpen ? (
        <button
          className="feishu-integration-prompt"
          onClick={() => setFeishuIntegrationOpen(true)}
          type="button"
        >
          <span
            aria-hidden="true"
            className="feishu-integration-alert-dot"
          />
          <span>完成飞书授权，解锁完整功能</span>
          <span className="sr-only">飞书授权未完成</span>
        </button>
      ) : null}

      <section className="minimal-main">
        <button
          aria-label="展开侧栏"
          className="open-sidebar"
          onClick={() => {
            setSidebarOpen(true);
            setMobileSidebarOpen(true);
          }}
          type="button"
        >
          <PanelLeftOpen size={19} />
        </button>

        {activeView === "experts" ? (
          <ExpertSkillWorkspace
            initialSceneId={expertWorkspaceSceneId}
            key={expertWorkspaceSceneId}
            onUseSkill={useExpertSkill}
          />
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <h1>Hi 哈基咪(Manbo)，有什么可以帮你的？</h1>
              <HomeSkillDiscovery
                onSelectCategory={setSelectedHomeSkillCategory}
                selectedCategory={selectedHomeSkillCategory}
                functions={homeCategoryFunctions}
                onSelectFunction={(homeFunction) => {
                  setSelectedComposerSkills([]);
                  clearComposerExpert();
                  composerHandleRef.current?.setText(
                    homeFunction.standardQuestion,
                  );
                }}
                onShowMore={() => {
                  const targetScene = getHomeCategoryTargetScene(
                    selectedHomeSkillCategory,
                  );
                  if (!targetScene) return;
                  setExpertWorkspaceSceneId(targetScene);
                  activeViewRef.current = "experts";
                  setActiveView("experts");
                  setMobileSidebarOpen(false);
                }}
                showMore={
                  getHomeCategoryTargetScene(selectedHomeSkillCategory) !== null
                }
              />
              <Composer
                input={input}
                onInput={setInput}
                onKeyDown={handleKeyDown}
                onRemoveExpert={clearComposerExpert}
                onRemoveSkill={removeComposerSkill}
                onAddSkill={bindComposerSkill}
                onSubmit={submit}
                onStop={() => activeTaskId && cancelTask(activeTaskId)}
                planMode={planMode}
                running={running}
                selectedSkills={selectedComposerSkills}
                selectedExpert={selectedComposerExpert}
                selectedModelId={selectedModelId}
                selectModel={setSelectedModelId}
                togglePlanMode={() => setPlanMode((current) => !current)}
                ref={composerHandleRef}
              />
              <HomeSuggestedQuestions
                questions={homeSuggestedQuestions}
                onSelect={(question) => {
                  setSelectedComposerSkills([]);
                  clearComposerExpert();
                  composerHandleRef.current?.setText(question);
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div aria-live="polite" className="chat-scroll">
              <div className="chat-column">
                {messages.map((message) => (
                  <article
                    aria-label={
                      message.role === "assistant" ? "Agent 回复" : "用户消息"
                    }
                    className={`chat-message ${message.role}`}
                    id={`message-${message.id}`}
                    key={message.id}
                  >
                    <div className="chat-message-content">
                      {message.role === "assistant" ? (
                        <>
                          <AssistantExecution
                            elapsedMs={
                              message.pending
                                ? elapsedMs
                                : (message.elapsedMs ?? 0)
                            }
                            message={message}
                            onDeriveMerchant={() =>
                              deriveMerchantVersion(message.id)
                            }
                            onGenerateInternal={() =>
                              generateInternalFromFallback(message.id)
                            }
                          />
                          {!message.pending ? (
                            <AnswerActions
                              content={message.content}
                              disabled={running}
                              favorited={Boolean(message.favorited)}
                              onDislike={() => openFeedback(message.id)}
                              onCopyRequestId={() =>
                                void copyRequestId(message.id)
                              }
                              onRegenerate={() => regenerateMessage(message.id)}
                              onToggleFavorite={() =>
                                activeTaskId &&
                                toggleAnswerFavorite(activeTaskId, message.id)
                              }
                              requestId={message.id}
                            />
                          ) : null}
                        </>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  </article>
                ))}
                <div ref={scrollEndRef} />
              </div>
            </div>
            <div className="docked-composer">
              <Composer
                input={input}
                onInput={setInput}
                onKeyDown={handleKeyDown}
                onRemoveExpert={clearComposerExpert}
                onRemoveSkill={removeComposerSkill}
                onAddSkill={bindComposerSkill}
                onSubmit={submit}
                onStop={() => activeTaskId && cancelTask(activeTaskId)}
                planMode={planMode}
                running={running}
                selectedSkills={selectedComposerSkills}
                selectedExpert={selectedComposerExpert}
                selectedModelId={selectedModelId}
                selectModel={setSelectedModelId}
                togglePlanMode={() => setPlanMode((current) => !current)}
                ref={composerHandleRef}
              />
            </div>
          </>
        )}
      </section>

      {mobileSidebarOpen && (
        <button
          aria-label="关闭侧栏"
          className="sidebar-scrim"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />
      )}

      {searchOpen && (
        <div className="search-modal-layer">
          <button
            aria-label="关闭任务搜索"
            className="search-modal-scrim"
            onClick={closeSearch}
            type="button"
          />
          <section
            aria-labelledby="search-dialog-title"
            aria-modal="true"
            className="search-dialog"
            onKeyDown={handleDialogKeyDown}
            role="dialog"
          >
            <div className="search-dialog-header">
              <label className="task-search-field">
                <Search aria-hidden="true" size={23} strokeWidth={1.7} />
                <span className="sr-only">搜索任务</span>
                <input
                  aria-activedescendant={
                    filteredTasks[activeResultIndex]
                      ? `recent-task-result-${filteredTasks[activeResultIndex].id}`
                      : undefined
                  }
                  aria-controls="recent-task-results"
                  autoComplete="off"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveResultIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索任务"
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                />
              </label>
              <button
                aria-label="关闭搜索"
                className="search-dialog-close"
                onClick={closeSearch}
                type="button"
              >
                <X size={24} strokeWidth={1.7} />
              </button>
            </div>

            <h2 id="search-dialog-title">最近任务</h2>
            <ul
              aria-live="polite"
              className="search-results"
              id="recent-task-results"
            >
              {filteredTasks.length ? (
                filteredTasks.map((task, index) => (
                  <li key={task.id}>
                    <button
                      aria-current={
                        activeView === "chat" && activeTaskId === task.id
                          ? "page"
                          : undefined
                      }
                      className={`search-result ${
                        activeResultIndex === index ? "active" : ""
                      }`}
                      id={`recent-task-result-${task.id}`}
                      onClick={() => openTask(task)}
                      onMouseEnter={() => setActiveResultIndex(index)}
                      type="button"
                    >
                      <strong>{task.title}</strong>
                      <span className="search-result-created-at">
                        <span>创建时间</span>
                        <time dateTime={new Date(task.createdAt).toISOString()}>
                          {formatTaskTimestamp(new Date(task.createdAt))}
                        </time>
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="search-empty">
                  <Search size={24} strokeWidth={1.5} />
                  <strong>未找到相关任务</strong>
                  <span>换个关键词试试</span>
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {libraryDialog && (
        <div className="library-modal-layer">
          <button
            aria-label={`关闭${libraryDialog === "favorites" ? "我的收藏" : "我的归档"}`}
            className="library-modal-scrim"
            onClick={closeLibrary}
            type="button"
          />
          <section
            aria-labelledby="library-dialog-title"
            aria-modal="true"
            className="library-dialog"
            inert={deleteConfirmationTask ? true : undefined}
            onKeyDown={handleLibraryKeyDown}
            role="dialog"
          >
            <header>
              <div>
                <span>{libraryDialog === "favorites" ? "COLLECTION" : "ARCHIVE"}</span>
                <h2 id="library-dialog-title">
                  {libraryDialog === "favorites" ? "我的收藏" : "我的归档"}
                </h2>
              </div>
              <button
                aria-label="关闭"
                className="library-close"
                onClick={closeLibrary}
                ref={libraryCloseRef}
                type="button"
              >
                <X size={21} />
              </button>
            </header>

            <div className="library-content">
              {libraryDialog === "favorites" ? (
                <>
                  <section className="library-group">
                    <h3>
                      收藏的任务 <span>{favoriteTasks.length}</span>
                    </h3>
                    {favoriteTasks.length ? (
                      <div className="library-list">
                        {favoriteTasks.map((task) => (
                          <article
                            className="library-row favorite-task-row"
                            key={task.id}
                          >
                            <button
                              className="library-row-main"
                              onClick={() => openTaskFromLibrary(task)}
                              type="button"
                            >
                              <strong>{task.title}</strong>
                              <span>
                                创建时间：
                                <time
                                  dateTime={new Date(
                                    task.createdAt,
                                  ).toISOString()}
                                >
                                  {formatTaskTimestamp(
                                    new Date(task.createdAt),
                                  )}
                                </time>
                              </span>
                            </button>
                            <button
                              aria-label={`取消收藏任务：${task.title}`}
                              className="library-row-action favorite-cancel-button selected"
                              onClick={() => toggleTaskFavorite(task.id)}
                              type="button"
                            >
                              <Bookmark size={17} fill="currentColor" />
                              <span>取消收藏</span>
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="library-empty">暂无收藏的任务</p>
                    )}
                  </section>

                  <section className="library-group">
                    <h3>
                      收藏的答案 <span>{favoriteAnswers.length}</span>
                    </h3>
                    {favoriteAnswers.length ? (
                      <div className="library-list">
                        {favoriteAnswers.map((answer) => (
                          <article
                            className="library-row answer-row favorite-answer-row"
                            key={`${answer.taskId}-${answer.message.id}`}
                          >
                            <button
                              className="library-row-main favorite-answer-main"
                              onClick={() =>
                                openFavoriteAnswer(
                                  answer.taskId,
                                  answer.message.id,
                                )
                              }
                              type="button"
                            >
                              <strong>{answer.taskTitle}</strong>
                              <span title={answer.question}>
                                问题：{answer.question}
                              </span>
                              <span title={answer.message.content}>
                                答案
                                {answer.message.audience
                                  ? `（${answer.message.audience === "merchant" ? "对商版本" : "对内版本"}）`
                                  : ""}
                                ：{answer.message.content}
                              </span>
                            </button>
                            <button
                              aria-label="取消收藏答案"
                              className="library-row-action favorite-cancel-button selected"
                              onClick={() =>
                                toggleAnswerFavorite(
                                  answer.taskId,
                                  answer.message.id,
                                )
                              }
                              type="button"
                            >
                              <Bookmark size={17} fill="currentColor" />
                              <span>取消收藏</span>
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="library-empty">暂无收藏的答案</p>
                    )}
                  </section>
                </>
              ) : archivedTasks.length ? (
                <div className="library-list archive-list">
                  {archivedTasks.map((task) => (
                    <article className="library-row archive-row" key={task.id}>
                      <div className="library-row-main archive-task-info">
                        <strong>{task.title}</strong>
                        <span>
                          创建时间：
                          <time dateTime={new Date(task.createdAt).toISOString()}>
                            {formatTaskTimestamp(new Date(task.createdAt))}
                          </time>
                        </span>
                        <span>
                          最后更新：
                          <time dateTime={new Date(task.updatedAt).toISOString()}>
                            {formatTaskTimestamp(new Date(task.updatedAt))}
                          </time>
                        </span>
                      </div>
                      <div className="archive-row-actions">
                        <button
                          className="restore-task-button"
                          onClick={() => restoreTask(task.id)}
                          type="button"
                        >
                          恢复
                        </button>
                        <button
                          aria-label={`删除归档任务：${task.title}`}
                          className="delete-task-button"
                          onClick={(event) =>
                            openDeleteConfirmation(
                              task.id,
                              event.currentTarget,
                            )
                          }
                          type="button"
                        >
                          <Trash2 size={15} />
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="library-empty-state">
                  <Archive size={24} />
                  <strong>暂无归档任务</strong>
                  <span>归档后的任务会集中显示在这里</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <FeishuIntegrationDialog
        onClose={() => {
          setFeishuIntegrationOpen(false);
          requestAnimationFrame(() => accountButtonRef.current?.focus());
        }}
        onToast={(message) => {
          setFeedbackNotice(message);
          window.setTimeout(() => setFeedbackNotice(""), 3_000);
        }}
        onTryNow={() => {
          startNewChat();
          setInput(feishuTryNowPrompt);
          setFeishuIntegrationOpen(false);
          window.requestAnimationFrame(() => {
            composerHandleRef.current?.setText(feishuTryNowPrompt);
          });
        }}
        open={feishuIntegrationOpen}
      />

      {deleteConfirmationTask ? (
        <div className="delete-confirmation-layer">
          <button
            aria-label="取消删除"
            className="delete-confirmation-scrim"
            onClick={closeDeleteConfirmation}
            type="button"
          />
          <section
            aria-describedby="delete-confirmation-description"
            aria-labelledby="delete-confirmation-title"
            aria-modal="true"
            className="delete-confirmation-dialog"
            onKeyDown={handleDeleteConfirmationKeyDown}
            role="alertdialog"
          >
            <h2 id="delete-confirmation-title">确认删除任务</h2>
            <p id="delete-confirmation-description">
              该任务将被永久删除，无法恢复，是否确认删除？
            </p>
            <div>
              <button
                className="delete-confirmation-cancel"
                onClick={closeDeleteConfirmation}
                ref={deleteCancelRef}
                type="button"
              >
                取消
              </button>
              <button
                className="delete-confirmation-submit"
                onClick={() => deleteArchivedTask(deleteConfirmationTask.id)}
                type="button"
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {feedbackTargetId && (
        <div className="feedback-modal-layer">
          <button
            aria-label="关闭反馈弹窗"
            className="feedback-modal-scrim"
            onClick={closeFeedback}
            type="button"
          />
          <form
            aria-labelledby="feedback-dialog-title"
            aria-modal="true"
            className="feedback-dialog"
            onKeyDown={handleFeedbackKeyDown}
            onSubmit={submitFeedback}
            role="dialog"
          >
            <header>
              <h2 id="feedback-dialog-title">
                {feedbackMode === "general" ? "意见反馈" : "提交反馈"}
              </h2>
              <button
                aria-label="关闭反馈"
                onClick={closeFeedback}
                ref={feedbackCloseRef}
                type="button"
              >
                <X size={22} strokeWidth={1.7} />
              </button>
            </header>

            {feedbackMode === "answer" ? (
              <>
                <div aria-label="反馈原因" className="feedback-reasons">
                  {feedbackReasons.map((reason) => {
                    const selected = selectedFeedbackReasons.includes(reason);
                    return (
                      <button
                        aria-pressed={selected}
                        className={selected ? "selected" : ""}
                        key={reason}
                        onClick={() =>
                          setSelectedFeedbackReasons((current) =>
                            current.includes(reason)
                              ? current.filter((item) => item !== reason)
                              : [...current, reason],
                          )
                        }
                        type="button"
                      >
                        <Plus size={15} strokeWidth={1.7} />
                        {reason}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  aria-label="反馈详情"
                  onChange={(event) => setFeedbackDetail(event.target.value)}
                  placeholder="填写详情（选填）"
                  value={feedbackDetail}
                />

                <p className="feedback-help">
                  您的反馈可帮助我们持续优化交易智能助手
                  <button
                    onClick={() => {
                      setFeedbackNotice("反馈群入口为演示功能");
                      window.setTimeout(() => setFeedbackNotice(""), 3_000);
                    }}
                    type="button"
                  >
                    点击加入反馈群
                  </button>
                </p>
              </>
            ) : (
              <div className="general-feedback-field">
                <textarea
                  aria-label="意见反馈内容"
                  maxLength={10000}
                  onChange={(event) => setFeedbackDetail(event.target.value)}
                  placeholder="你可以描述你遇到的问题"
                  value={feedbackDetail}
                />

                {feedbackImages.length ? (
                  <div aria-label="已添加图片" className="feedback-image-grid">
                    {feedbackImages.map((image) => (
                      <figure key={image.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={image.name} src={image.url} />
                        <button
                          aria-label={`移除图片：${image.name}`}
                          onClick={() => removeFeedbackImage(image.id)}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : null}

                <div className="general-feedback-footer">
                  <input
                    accept="image/*"
                    hidden
                    multiple
                    onChange={(event) => {
                      addFeedbackImages(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                    ref={feedbackImageInputRef}
                    type="file"
                  />
                  <button
                    disabled={feedbackImages.length >= 6}
                    onClick={() => feedbackImageInputRef.current?.click()}
                    type="button"
                  >
                    <ImagePlus size={17} />
                    上传图片 ({feedbackImages.length}/6)
                  </button>
                  <span>{feedbackDetail.length}/10000</span>
                </div>
              </div>
            )}

            <button
              className="feedback-submit"
              disabled={
                feedbackMode === "general"
                  ? !feedbackDetail.trim() && !feedbackImages.length
                  : !selectedFeedbackReasons.length && !feedbackDetail.trim()
              }
              type="submit"
            >
              提交
            </button>
          </form>
        </div>
      )}

      {favoriteToastOpen ? (
        <div
          aria-live="polite"
          className="feedback-toast favorite-toast"
          role="status"
        >
          <span>收藏成功，可前往</span>
          <button
            onClick={() => {
              if (favoriteToastTimerRef.current) {
                window.clearTimeout(favoriteToastTimerRef.current);
                favoriteToastTimerRef.current = null;
              }
              setFavoriteToastOpen(false);
              openLibrary("favorites");
            }}
            type="button"
          >
            “我的收藏”
          </button>
          <span>中查看</span>
        </div>
      ) : feedbackNotice ? (
        <div aria-live="polite" className="feedback-toast" role="status">
          {feedbackNotice}
        </div>
      ) : null}

    </main>
  );
}

function HomeSkillDiscovery({
  selectedCategory,
  functions,
  onSelectCategory,
  onSelectFunction,
  onShowMore,
  showMore,
}: {
  selectedCategory: HomeFunctionCategoryId;
  functions: HomeFunctionDefinition[];
  onSelectCategory: (category: HomeFunctionCategoryId) => void;
  onSelectFunction: (homeFunction: HomeFunctionDefinition) => void;
  onShowMore: () => void;
  showMore: boolean;
}) {
  return (
    <section aria-label="推荐功能" className="home-skill-discovery">
      <div aria-label="业务场景" className="home-skill-tabs" role="tablist">
        {homeFunctionCategories.map((category) => (
          <button
            aria-controls="home-scene-skills"
            aria-selected={selectedCategory === category.id}
            className={selectedCategory === category.id ? "selected" : ""}
            id={`home-skill-tab-${category.id}`}
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            role="tab"
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="home-discovery-options">
        <div
          aria-labelledby={`home-skill-tab-${selectedCategory}`}
          className="home-scene-skill-options"
          id="home-scene-skills"
          role="tabpanel"
        >
          {functions.map((homeFunction) => (
            <button
              className="home-skill-card home-skill-option"
              key={homeFunction.id}
              onClick={() => onSelectFunction(homeFunction)}
              title={homeFunction.description}
              type="button"
            >
              <strong>{homeFunction.name}</strong>
              <span className="home-skill-tooltip" role="tooltip">
                {homeFunction.description}
              </span>
            </button>
          ))}
          {showMore ? (
            <button
              className="home-discovery-more"
              onClick={onShowMore}
              type="button"
            >
              更多功能
              <ChevronRight aria-hidden="true" size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HomeSuggestedQuestions({
  questions,
  onSelect,
}: {
  questions: ReturnType<typeof getHomeSuggestedQuestions>;
  onSelect: (question: string) => void;
}) {
  if (!questions.length) return null;

  return (
    <section
      aria-label="猜你想问"
      className="home-suggested-questions"
    >
      <p>不知道怎么问？试试这些问法</p>
      <div className="home-suggested-question-list">
        {questions.map((question) => (
          <button
            key={question.id}
            onClick={() => onSelect(question.standardQuestion)}
            title={question.standardQuestion}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="home-suggested-question-star"
              height={14}
              src="./recommended-question-star.svg"
              width={14}
            />
            <span>{question.standardQuestion}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SidebarTaskSection({
  title,
  expanded,
  onToggle,
  tasks,
  activeTaskId,
  activeView,
  relativeTimeNow,
  taskMenuId,
  renamingTaskId,
  renameValue,
  openTask,
  setTaskMenuId,
  setRenamingTaskId,
  setRenameValue,
  commitTaskRename,
  toggleTaskPin,
  toggleTaskFavorite,
  archiveTask,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  tasks: RecentTask[];
  activeTaskId: string | null;
  activeView: WorkspaceView;
  relativeTimeNow: number;
  taskMenuId: string | null;
  renamingTaskId: string | null;
  renameValue: string;
  openTask: (task: RecentTask) => void;
  setTaskMenuId: (id: string | null) => void;
  setRenamingTaskId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
  commitTaskRename: (id: string) => void;
  toggleTaskPin: (id: string) => void;
  toggleTaskFavorite: (id: string) => void;
  archiveTask: (id: string) => void;
}) {
  return (
    <section
      className={`recent-section ${title === "置顶任务" ? "pinned-section" : ""}`}
    >
      <button
        aria-expanded={expanded}
        className="task-section-toggle"
        onClick={onToggle}
        type="button"
      >
        <span>
          {title}
          {title === "置顶任务" ? ` (${tasks.length})` : ""}
        </span>
        <ChevronDown className={expanded ? "open" : ""} size={15} />
      </button>
      {expanded ? (
        <nav aria-label={title}>
          {tasks.map((task) => {
            const relativeTime = formatRelativeTaskTime(
              task.updatedAt,
              relativeTimeNow,
            );
            const isViewing =
              activeView === "chat" && activeTaskId === task.id;
            const activityIndicator = getTaskActivityIndicator(
              task,
              isViewing,
            );
            return (
              <div className="recent-task-row" key={task.id}>
                {renamingTaskId === task.id ? (
                  <input
                    aria-label="编辑任务名称"
                    autoFocus
                    className="task-rename-input"
                    onBlur={() => commitTaskRename(task.id)}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitTaskRename(task.id);
                      if (event.key === "Escape") setRenamingTaskId(null);
                    }}
                    value={renameValue}
                  />
                ) : (
                  <button
                    aria-current={isViewing ? "page" : undefined}
                    className={`task-open-button ${isViewing ? "current" : ""}`}
                    onClick={() => openTask(task)}
                    type="button"
                  >
                    <span className="recent-task-title">{task.title}</span>
                    <span className="recent-task-meta">
                      {activityIndicator === "spinner" ? (
                        <>
                          <LoaderCircle
                            aria-hidden="true"
                            className="recent-task-spinner"
                            size={14}
                          />
                          <span className="sr-only">执行中</span>
                        </>
                      ) : activityIndicator === "attention" ? (
                        <span className="recent-task-attention">
                          <span className="sr-only">已完成，未查看</span>
                        </span>
                      ) : (
                        <time dateTime={new Date(task.updatedAt).toISOString()}>
                          {relativeTime}
                        </time>
                      )}
                    </span>
                  </button>
                )}
                <button
                  aria-label={`管理任务：${task.title}`}
                  className="task-more-button"
                  onClick={() =>
                    setTaskMenuId(taskMenuId === task.id ? null : task.id)
                  }
                  type="button"
                >
                  <Ellipsis size={17} />
                </button>
                {taskMenuId === task.id ? (
                  <div
                    aria-label="任务操作"
                    className="task-context-menu"
                    role="menu"
                  >
                    <button
                      onClick={() => {
                        setRenamingTaskId(task.id);
                        setRenameValue(task.title);
                        setTaskMenuId(null);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Pencil size={16} />
                      重命名
                    </button>
                    <button
                      onClick={() => toggleTaskPin(task.id)}
                      role="menuitem"
                      type="button"
                    >
                      <Pin size={16} />
                      {task.pinned ? "取消置顶" : "置顶"}
                    </button>
                    <button
                      onClick={() => toggleTaskFavorite(task.id)}
                      role="menuitem"
                      type="button"
                    >
                      <Bookmark
                        fill={task.favorited ? "currentColor" : "none"}
                        size={16}
                      />
                      {task.favorited ? "取消收藏" : "收藏"}
                    </button>
                    <button
                      onClick={() => archiveTask(task.id)}
                      role="menuitem"
                      type="button"
                    >
                      <Archive size={16} />
                      归档
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}

function formatElapsedTime(elapsedMs: number) {
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function AssistantExecution({
  elapsedMs,
  forceOpen = false,
  message,
  onDeriveMerchant,
  onGenerateInternal,
}: {
  elapsedMs: number;
  forceOpen?: boolean;
  message: TaskMessage;
  onDeriveMerchant: () => void;
  onGenerateInternal: () => void;
}) {
  const hasExecutionTrace = Boolean(message.trace?.length || message.pending);

  if (
    !hasExecutionTrace &&
    !message.answeringAgent &&
    !message.audience &&
    !message.fallback
  ) {
    return <p>{message.content}</p>;
  }

  return (
    <section
      aria-label="Agent 执行过程"
      className={`assistant-execution ${message.pending ? "running" : "completed"}`}
    >
      {message.answeringAgent ? (
        <header
          aria-label={`由${message.answeringAgent.name}回答`}
          className="answer-expert-identity"
        >
          <span aria-hidden="true" className="answer-expert-avatar">
            <Bot size={18} strokeWidth={1.8} />
          </span>
          <strong>{message.answeringAgent.name}</strong>
        </header>
      ) : null}

      {hasExecutionTrace ? (
        <details
          className="execution-details"
          open={message.pending || forceOpen || undefined}
        >
          <summary aria-label="展开或折叠思考过程" className="execution-duration">
            <span aria-hidden="true" className="execution-duration-mark" />
            <span>
              {message.answeringAgent
                ? message.pending
                  ? "处理中"
                  : "已完成"
                : "已处理"}
            </span>
            <time>{formatElapsedTime(elapsedMs)}</time>
            <ChevronRight
              aria-hidden="true"
              className="execution-chevron"
              size={14}
              strokeWidth={1.8}
            />
          </summary>

          {message.trace?.length ? (
            <ol aria-label="思考与 Skill 调用步骤" className="execution-trace">
              {message.trace.map((step) => (
                <li className={step.status} key={step.id}>
                  <span aria-hidden="true" className="trace-node">
                    {step.status === "running" ? (
                      <LoaderCircle size={13} strokeWidth={1.9} />
                    ) : (
                      <Check size={12} strokeWidth={2} />
                    )}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </details>
      ) : null}

      {message.content ? (
        <div className="assistant-final-answer">
          {message.fallback ? (
            <p className="audience-answer-footer unavailable">
              <span>{message.content}</span>
              {!message.pending &&
              message.fallback === "merchant_unavailable_prompt" &&
              !message.derivedAnswerId ? (
                <button onClick={onGenerateInternal} type="button">
                  生成对内版本
                </button>
              ) : null}
            </p>
          ) : (
            <>
              <p>{message.content}</p>
              {!message.pending && message.audience === "internal" ? (
                <p className="audience-answer-footer internal">
                  <span>
                    以上信息仅供公司内部参考，请勿直接转发给商家
                  </span>
                  {message.canDeriveMerchant &&
                  !message.derivedAnswerId ? (
                    <span>
                      如需转发商家，可
                      <button onClick={onDeriveMerchant} type="button">
                        生成对商版本
                      </button>
                    </span>
                  ) : null}
                </p>
              ) : null}
              {!message.pending && message.audience === "merchant" ? (
                <p className="audience-answer-footer merchant">
                  以上信息可转发商家
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {message.pending ? (
        <div aria-live="polite" className="generating-reply" role="status">
          <span>生成回复中</span>
          <span aria-hidden="true" className="generating-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : null}
    </section>
  );
}

function AnswerActions({
  content,
  disabled,
  favorited,
  onCopyRequestId,
  onDislike,
  onRegenerate,
  onToggleFavorite,
  requestId,
}: {
  content: string;
  disabled: boolean;
  favorited: boolean;
  onCopyRequestId: () => void;
  onDislike: () => void;
  onRegenerate: () => void;
  onToggleFavorite: () => void;
  requestId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreControlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !moreControlRef.current?.contains(event.target)
      ) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreMenuOpen]);

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

  const shareAnswer = async () => {
    if (navigator.share) {
      await navigator.share({ title: "交易智能助手回答", text: content });
    } else {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    }
  };

  return (
    <div aria-label="回答操作" className="answer-actions" role="toolbar">
      <button
        aria-label={copied ? "已复制" : "复制回答"}
        onClick={() => void copyAnswer()}
        type="button"
      >
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
      <button
        aria-label="点赞"
        aria-pressed={liked}
        className={liked ? "active" : ""}
        onClick={() => {
          setLiked((current) => !current);
          setDisliked(false);
        }}
        type="button"
      >
        <ThumbsUp size={17} />
      </button>
      <button
        aria-label="点踩"
        aria-pressed={disliked}
        className={disliked ? "active" : ""}
        onClick={() => {
          setDisliked(true);
          setLiked(false);
          onDislike();
        }}
        type="button"
      >
        <ThumbsDown size={17} />
      </button>
      <button
        aria-label="重新生成回答"
        disabled={disabled}
        onClick={onRegenerate}
        type="button"
      >
        <RotateCcw size={17} />
      </button>
      <button
        aria-label="分享回答"
        onClick={() => void shareAnswer()}
        type="button"
      >
        <Share2 size={17} />
      </button>
      <div className="answer-more-control" ref={moreControlRef}>
        <button
          aria-expanded={moreMenuOpen}
          aria-haspopup="menu"
          aria-label="更多操作"
          onClick={() => setMoreMenuOpen((current) => !current)}
          type="button"
        >
          <Ellipsis size={18} />
        </button>
        {moreMenuOpen ? (
          <div aria-label="答案更多操作" className="answer-more-menu" role="menu">
            <button
              onClick={() => {
                onToggleFavorite();
                setMoreMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <Bookmark fill={favorited ? "currentColor" : "none"} size={16} />
              {favorited ? "取消收藏" : "收藏"}
            </button>
            <button
              aria-label={`复制请求 ID：${requestId}`}
              onClick={() => {
                onCopyRequestId();
                setMoreMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <Copy size={16} />
              复制请求 ID
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const Composer = forwardRef<ComposerHandle, {
  input: string;
  onInput: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onAddSkill: (skill: ComposerSkillOption) => void;
  onRemoveExpert: () => void;
  onRemoveSkill: (skillKey: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStop: () => void;
  planMode: boolean;
  running: boolean;
  selectedExpert: ComposerExpertOption | null;
  selectedSkills: ComposerSkillOption[];
  selectedModelId: ModelId;
  selectModel: (modelId: ModelId) => void;
  togglePlanMode: () => void;
}>(function Composer({
  input,
  onInput,
  onKeyDown,
  onAddSkill,
  onRemoveExpert,
  onRemoveSkill,
  onSubmit,
  onStop,
  planMode,
  running,
  selectedExpert,
  selectedSkills,
  selectedModelId,
  selectModel,
  togglePlanMode,
}, ref) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const addControlRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modelControlRef = useRef<HTMLDivElement | null>(null);
  const skillMenuRef = useRef<HTMLElement | null>(null);
  const skillSearchRef = useRef<HTMLInputElement | null>(null);
  const suggestionMenuRef = useRef<HTMLElement | null>(null);
  const skillInsertionRangeRef = useRef<Range | null>(null);
  const composingRef = useRef(false);
  const lastReportedInputRef = useRef(input);
  const filteredSkills = useMemo(
    () => filterComposerSkills(skillQuery),
    [skillQuery],
  );
  const visibleActiveSkillIndex = filteredSkills.length
    ? Math.min(activeSkillIndex, filteredSkills.length - 1)
    : 0;
  const questionSuggestions = useMemo(
    () => getQuestionSuggestions(input),
    [input],
  );
  const visibleActiveSuggestionIndex = questionSuggestions.length
    ? Math.min(activeSuggestionIndex, questionSuggestions.length - 1)
    : 0;
  const selectedSkillKeys = useMemo(
    () => new Set(selectedSkills.map((skill) => skill.key)),
    [selectedSkills],
  );
  const visibleAddMenuOpen = addMenuOpen;
  const visibleModelMenuOpen = modelMenuOpen;
  const visibleSuggestionsOpen =
    suggestionsOpen &&
    questionSuggestions.length > 0 &&
    !skillMenuOpen &&
    !visibleAddMenuOpen &&
    !visibleModelMenuOpen;
  const composerIsEmpty = input.trim().length === 0 && selectedSkills.length === 0;

  const readEditorInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return "";

    const readNode = (node: Node): string => {
      if (
        node instanceof HTMLElement &&
        node.classList.contains("composer-inline-skill")
      ) {
        return "";
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? "").replaceAll("\u200B", "");
      }
      if (node instanceof HTMLBRElement) return "\n";

      const content = Array.from(node.childNodes).map(readNode).join("");
      return node instanceof HTMLElement &&
        ["DIV", "P"].includes(node.tagName) &&
        content &&
        !content.endsWith("\n")
        ? `${content}\n`
        : content;
    };

    return Array.from(editor.childNodes)
      .map(readNode)
      .join("")
      .replace(/\n$/, "");
  }, []);

  const reportEditorInput = useCallback(() => {
    const editor = editorRef.current;
    let value = readEditorInput().slice(0, 2000);
    const hasSkillToken = Boolean(
      editor?.querySelector(".composer-inline-skill"),
    );
    if (!hasSkillToken && value.replace(/[\u200B\s]/gu, "") === "") {
      editor?.replaceChildren();
      value = "";
    }
    lastReportedInputRef.current = value;
    onInput(value);
    return value;
  }, [onInput, readEditorInput]);

  const syncRemovedSkillTokens = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const presentKeys = new Set(
      Array.from(
        editor.querySelectorAll<HTMLElement>(".composer-inline-skill"),
      )
        .map((token) => token.dataset.skillKey)
        .filter((key): key is string => Boolean(key)),
    );
    selectedSkills.forEach((skill) => {
      if (!presentKeys.has(skill.key)) onRemoveSkill(skill.key);
    });
  };

  const focusEditorAtInsertion = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const selection = window.getSelection();
    const savedRange = skillInsertionRangeRef.current;
    if (selection && savedRange?.startContainer.isConnected) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    skillInsertionRangeRef.current = range.cloneRange();
  }, []);

  const closeSkillMenu = useCallback(
    (restoreEditorFocus = false) => {
      setSkillMenuOpen(false);
      setSkillQuery("");
      setActiveSkillIndex(0);
      if (restoreEditorFocus) {
        requestAnimationFrame(focusEditorAtInsertion);
      }
    },
    [focusEditorAtInsertion],
  );

  const closeQuestionSuggestions = useCallback(() => {
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(0);
  }, []);

  const rememberEditorInsertion = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (range.collapsed && editor.contains(range.startContainer)) {
        skillInsertionRangeRef.current = range.cloneRange();
        return;
      }
    }
    if (skillInsertionRangeRef.current?.startContainer.isConnected) return;

    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    skillInsertionRangeRef.current = endRange;
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const inlineSkills = editor.querySelectorAll<HTMLElement>(
      ".composer-inline-skill",
    );
    const hasExternalTextChange = input !== lastReportedInputRef.current;
    const shouldClearRemovedSkills =
      selectedSkills.length === 0 && inlineSkills.length > 0;
    if (!hasExternalTextChange && !shouldClearRemovedSkills) return;

    if (input) {
      editor.replaceChildren(document.createTextNode(input));
    } else {
      editor.replaceChildren();
    }
    lastReportedInputRef.current = input;
    skillInsertionRangeRef.current = null;
  }, [input, selectedSkills.length]);

  useEffect(() => {
    if (
      !visibleAddMenuOpen &&
      !visibleModelMenuOpen &&
      !skillMenuOpen &&
      !suggestionsOpen
    ) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node) {
        if (visibleAddMenuOpen && !addControlRef.current?.contains(event.target)) {
          setAddMenuOpen(false);
        }
        if (visibleModelMenuOpen && !modelControlRef.current?.contains(event.target)) {
          setModelMenuOpen(false);
        }
        if (skillMenuOpen && !skillMenuRef.current?.contains(event.target)) {
          closeSkillMenu();
        }
        if (
          suggestionsOpen &&
          !suggestionMenuRef.current?.contains(event.target)
        ) {
          closeQuestionSuggestions();
        }
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddMenuOpen(false);
        setModelMenuOpen(false);
        closeSkillMenu(true);
        closeQuestionSuggestions();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [
    closeQuestionSuggestions,
    closeSkillMenu,
    skillMenuOpen,
    suggestionsOpen,
    visibleAddMenuOpen,
    visibleModelMenuOpen,
  ]);

  const replaceWithSkill = useCallback((skill: ComposerSkillOption) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();

    const token = document.createElement("span");
    token.className = "composer-inline-skill";
    token.contentEditable = "false";
    token.dataset.skillKey = skill.key;
    token.setAttribute("aria-label", `已选技能：${skill.name}`);
    token.setAttribute("title", skill.name);
    token.textContent = skill.name;

    const questionNode = document.createTextNode(` ${skill.standardQuestion}`);
    editor.replaceChildren(token, questionNode);

    const range = document.createRange();
    range.setStart(questionNode, questionNode.data.length);
    range.collapse(true);
    skillInsertionRangeRef.current = range.cloneRange();
    selection?.removeAllRanges();
    selection?.addRange(range);

    onAddSkill(skill);
    reportEditorInput();
    closeQuestionSuggestions();
    closeSkillMenu(true);
  }, [
    closeQuestionSuggestions,
    closeSkillMenu,
    onAddSkill,
    reportEditorInput,
  ]);

  const removeSkillTokenPreservingText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor
      .querySelectorAll<HTMLElement>(".composer-inline-skill")
      .forEach((token) => token.remove());
    reportEditorInput();
    focusEditorAtInsertion();
  }, [focusEditorAtInsertion, reportEditorInput]);

  const setComposerText = useCallback(
    (value: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const textNode = document.createTextNode(value);
      editor.replaceChildren(textNode);
      lastReportedInputRef.current = value;
      skillInsertionRangeRef.current = null;
      onInput(value);
      closeQuestionSuggestions();
      closeSkillMenu();
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(textNode, textNode.data.length);
      range.collapse(true);
      skillInsertionRangeRef.current = range.cloneRange();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    [closeQuestionSuggestions, closeSkillMenu, onInput],
  );

  useImperativeHandle(
    ref,
    () => ({
      removeSkillTokenPreservingText,
      replaceWithSkill,
      setText: setComposerText,
    }),
    [removeSkillTokenPreservingText, replaceWithSkill, setComposerText],
  );

  const openSkillSearchFromSlash = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (
      !range.collapsed ||
      node.nodeType !== Node.TEXT_NODE ||
      !editor.contains(node)
    ) {
      return false;
    }

    const text = node.textContent ?? "";
    const offset = range.startOffset;
    if (offset < 1 || text[offset - 1] !== "/") return false;
    if (offset > 1 && !/\s/u.test(text[offset - 2])) return false;

    const insertionRange = range.cloneRange();
    insertionRange.setStart(node, offset - 1);
    insertionRange.deleteContents();
    insertionRange.collapse(true);
    skillInsertionRangeRef.current = insertionRange.cloneRange();
    selection.removeAllRanges();
    selection.addRange(insertionRange);

    reportEditorInput();
    closeQuestionSuggestions();
    setSkillQuery("");
    setActiveSkillIndex(0);
    setSkillMenuOpen(true);
    setAddMenuOpen(false);
    setModelMenuOpen(false);
    requestAnimationFrame(() => skillSearchRef.current?.focus());
    return true;
  };

  const handleComposerInput = () => {
    syncRemovedSkillTokens();
    if (openSkillSearchFromSlash()) return;
    const value = reportEditorInput();
    rememberEditorInsertion();
    if (composingRef.current) return;
    const suggestions = getQuestionSuggestions(value);
    setActiveSuggestionIndex(0);
    setSuggestionsOpen(suggestions.length > 0);
  };

  const selectQuestionSuggestion = useCallback(
    (suggestion: QuestionSuggestion) => {
      const editor = editorRef.current;
      if (!editor) return;

      const tokens = Array.from(
        editor.querySelectorAll<HTMLElement>(".composer-inline-skill"),
      );
      const fragment = document.createDocumentFragment();
      tokens.forEach((token) => fragment.append(token));
      const questionNode = document.createTextNode(suggestion.question);
      fragment.append(questionNode);
      editor.replaceChildren(fragment);

      lastReportedInputRef.current = suggestion.question;
      onInput(suggestion.question);
      closeQuestionSuggestions();

      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(questionNode, questionNode.data.length);
      range.collapse(true);
      skillInsertionRangeRef.current = range.cloneRange();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    [closeQuestionSuggestions, onInput],
  );

  const removeAdjacentSkill = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.startContainer)) return false;

    let token: HTMLElement | null = null;
    const caretNode: Node = range.startContainer;
    let caretOffset = range.startOffset;

    if (caretNode.nodeType === Node.TEXT_NODE) {
      const textNode = caretNode as Text;
      const prefix = textNode.data.slice(0, caretOffset);
      if (!/^[\u200B\s]*$/u.test(prefix)) return false;
      token =
        textNode.previousSibling instanceof HTMLElement &&
        textNode.previousSibling.classList.contains("composer-inline-skill")
          ? textNode.previousSibling
          : null;
      if (token) {
        textNode.data = textNode.data.slice(caretOffset);
        caretOffset = 0;
      }
    } else if (caretNode === editor && caretOffset > 0) {
      const previous = editor.childNodes[caretOffset - 1];
      token =
        previous instanceof HTMLElement &&
        previous.classList.contains("composer-inline-skill")
          ? previous
          : null;
      caretOffset -= token ? 1 : 0;
    }

    const skillKey = token?.dataset.skillKey;
    if (!token || !skillKey) return false;
    token.remove();

    const nextRange = document.createRange();
    nextRange.setStart(caretNode, caretOffset);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    skillInsertionRangeRef.current = nextRange.cloneRange();
    onRemoveSkill(skillKey);
    reportEditorInput();
    return true;
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (visibleSuggestionsOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((current) =>
          Math.min(current + 1, questionSuggestions.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (
        event.key === "Enter" &&
        questionSuggestions[visibleActiveSuggestionIndex]
      ) {
        event.preventDefault();
        selectQuestionSuggestion(
          questionSuggestions[visibleActiveSuggestionIndex],
        );
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeQuestionSuggestions();
        return;
      }
      if (event.key === "Tab") closeQuestionSuggestions();
    }
    if (event.key === "Backspace" && removeAdjacentSkill()) {
      event.preventDefault();
      return;
    }
    onKeyDown(event);
  };

  const handleSkillSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSkillIndex((current) =>
        filteredSkills.length
          ? Math.min(current + 1, filteredSkills.length - 1)
          : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSkillIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && filteredSkills[visibleActiveSkillIndex]) {
      event.preventDefault();
      replaceWithSkill(filteredSkills[visibleActiveSkillIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSkillMenu(true);
    } else if (event.key === "Tab") {
      closeSkillMenu();
    }
  };

  return (
    <form className="minimal-composer" onSubmit={onSubmit}>
      {visibleSuggestionsOpen && (
        <section
          aria-label="问题联想"
          className="composer-question-suggestions"
          ref={suggestionMenuRef}
        >
          <header>
            <WandSparkles aria-hidden="true" size={15} strokeWidth={1.7} />
            <span>猜你想问</span>
          </header>
          <div
            aria-label="联想问题列表"
            id="composer-question-suggestion-list"
            role="listbox"
          >
            {questionSuggestions.map((suggestion, index) => (
              <button
                aria-selected={index === visibleActiveSuggestionIndex}
                className={
                  index === visibleActiveSuggestionIndex ? "active" : ""
                }
                id={`composer-question-suggestion-${suggestion.id}`}
                key={suggestion.id}
                onClick={() => selectQuestionSuggestion(suggestion)}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                role="option"
                title={suggestion.question}
                type="button"
              >
                <span>{suggestion.question}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {skillMenuOpen && (
        <section
          aria-label="选择技能"
          className="composer-skill-menu"
          id="composer-skill-list"
          ref={skillMenuRef}
        >
          <header>
            <label className="composer-skill-search">
              <Search aria-hidden="true" size={17} strokeWidth={1.8} />
              <span className="sr-only">搜索技能</span>
              <input
                aria-activedescendant={
                  filteredSkills[visibleActiveSkillIndex]
                    ? `composer-skill-${filteredSkills[visibleActiveSkillIndex].key}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls="composer-skill-options"
                aria-expanded="true"
                onChange={(event) => {
                  setSkillQuery(event.target.value);
                  setActiveSkillIndex(0);
                }}
                onKeyDown={handleSkillSearchKeyDown}
                placeholder="搜索技能"
                ref={skillSearchRef}
                role="combobox"
                value={skillQuery}
              />
              <span className="composer-skill-count">
                {filteredSkills.length === composerSkillOptions.length
                  ? composerSkillOptions.length
                  : `${filteredSkills.length}/${composerSkillOptions.length}`}
              </span>
            </label>
          </header>
          <div
            aria-label="技能列表"
            className="composer-skill-list"
            id="composer-skill-options"
            role="listbox"
          >
            {filteredSkills.length ? (
              filteredSkills.map((skill, index) => {
                const selected = selectedSkillKeys.has(skill.key);
                return (
                  <button
                    aria-selected={selected}
                    className={index === visibleActiveSkillIndex ? "active" : ""}
                    id={`composer-skill-${skill.key}`}
                    key={skill.key}
                    onClick={() => replaceWithSkill(skill)}
                    onMouseEnter={() => setActiveSkillIndex(index)}
                    role="option"
                    type="button"
                  >
                    <WandSparkles aria-hidden="true" size={17} strokeWidth={1.7} />
                    <span className="composer-skill-copy">
                      <strong>{skill.name}</strong>
                      <span className="composer-skill-expert">
                        {skill.expertLabel}
                      </span>
                      <small>{skill.description}</small>
                    </span>
                    {selected && (
                      <Check
                        aria-hidden="true"
                        className="composer-skill-check"
                        size={17}
                        strokeWidth={2.2}
                      />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="composer-skill-empty">未找到相关技能</p>
            )}
          </div>
        </section>
      )}
      <div
        aria-activedescendant={
          visibleSuggestionsOpen &&
          questionSuggestions[visibleActiveSuggestionIndex]
            ? `composer-question-suggestion-${questionSuggestions[visibleActiveSuggestionIndex].id}`
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={
          visibleSuggestionsOpen
            ? "composer-question-suggestion-list"
            : undefined
        }
        aria-haspopup="listbox"
        aria-label="任务输入框"
        aria-multiline="true"
        className="composer-editor"
        contentEditable
        data-empty={composerIsEmpty}
        data-placeholder={composerPlaceholder}
        onBlur={rememberEditorInsertion}
        onCompositionEnd={() => {
          composingRef.current = false;
          handleComposerInput();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
          closeQuestionSuggestions();
        }}
        onInput={handleComposerInput}
        onKeyDown={handleComposerKeyDown}
        onKeyUp={rememberEditorInsertion}
        onMouseUp={rememberEditorInsertion}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
      <div className="composer-actions">
        <div className="composer-left-actions">
          <div className="add-control" ref={addControlRef}>
            <input
              hidden
              multiple
              onChange={() => {
                setAddMenuOpen(false);
              }}
              ref={fileInputRef}
              type="file"
            />
            <button
              aria-expanded={visibleAddMenuOpen}
              aria-haspopup="menu"
              aria-label="打开添加菜单"
              className="composer-add-button"
              onClick={() => {
                closeQuestionSuggestions();
                setModelMenuOpen(false);
                setAddMenuOpen((current) => !current);
              }}
              onPointerDown={rememberEditorInsertion}
              type="button"
            >
              <Plus size={19} strokeWidth={1.8} />
            </button>

            {visibleAddMenuOpen && (
              <div aria-label="添加内容" className="add-menu" role="menu">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  role="menuitem"
                  type="button"
                >
                  <FilePlus2 size={18} strokeWidth={1.7} />
                  <span>添加文件</span>
                </button>
                <button
                  aria-checked={planMode}
                  className="mode-switch-row"
                  onClick={togglePlanMode}
                  role="switch"
                  type="button"
                >
                  <span>
                    <strong>计划模式</strong>
                    <small>先制定计划，再执行任务</small>
                  </span>
                  <span className="switch-track" aria-hidden="true">
                    <span />
                  </span>
                </button>
              </div>
            )}
          </div>
          {selectedExpert ? (
            <button
              aria-label={`取消召唤专家：${selectedExpert.name}`}
              className="composer-expert-tag"
              onClick={onRemoveExpert}
              title={`取消召唤${selectedExpert.name}`}
              type="button"
            >
              <span className="composer-expert-tag-icons" aria-hidden="true">
                <Bot className="composer-expert-tag-default-icon" size={18} />
                <X className="composer-expert-tag-close-icon" size={19} />
              </span>
              <span>{selectedExpert.name}</span>
            </button>
          ) : null}
          {planMode ? (
            <button
              aria-label="关闭计划模式"
              className="plan-mode-tag"
              onClick={togglePlanMode}
              title="关闭计划模式"
              type="button"
            >
              <span className="plan-mode-tag-icons" aria-hidden="true">
                <ClipboardList className="plan-mode-tag-default-icon" size={18} />
                <X className="plan-mode-tag-close-icon" size={19} />
              </span>
              <span>计划</span>
            </button>
          ) : null}
        </div>

        <div className="composer-right-actions">
          <div className="model-control" ref={modelControlRef}>
            <button
              aria-expanded={visibleModelMenuOpen}
              aria-haspopup="menu"
              className="model-selector"
              onClick={() => {
                closeQuestionSuggestions();
                setAddMenuOpen(false);
                setModelMenuOpen((current) => !current);
              }}
              type="button"
            >
              {selectedModelId}
              <ChevronDown className={visibleModelMenuOpen ? "open" : ""} size={13} />
            </button>

            {visibleModelMenuOpen && (
              <div aria-label="选择模型" className="model-menu" role="menu">
                {modelOptions.map((model) => (
                  <button
                    aria-checked={model.id === selectedModelId}
                    className={model.id === selectedModelId ? "selected" : ""}
                    key={model.id}
                    onClick={() => {
                      selectModel(model.id);
                      setModelMenuOpen(false);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>{model.label}</span>
                    {"imageUnderstanding" in model &&
                      model.imageUnderstanding && (
                        <span className="image-capability">图片理解</span>
                      )}
                    {model.id === selectedModelId && (
                      <Check
                        className="model-selected-check"
                        size={17}
                        strokeWidth={2.4}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {running ? (
            <button
              aria-label="停止生成"
              className="composer-send"
              onClick={onStop}
              type="button"
            >
              <Image
                alt=""
                aria-hidden="true"
                height={24}
                src="./send-loading.svg"
                width={24}
              />
            </button>
          ) : (
            <button
              aria-label="发送"
              className="composer-send"
              disabled={skillMenuOpen || (!input.trim() && !selectedSkills.length)}
              type="submit"
            >
              <Image
                alt=""
                aria-hidden="true"
                height={24}
                src={
                  !skillMenuOpen && (input.trim() || selectedSkills.length)
                    ? "./send-ready.svg"
                    : "./send-empty.svg"
                }
                width={24}
              />
            </button>
          )}
        </div>
      </div>
    </form>
  );
});
