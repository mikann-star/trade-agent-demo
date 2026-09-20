import type { TaskTraceStep } from "./task-history";

export type AnswerSnapshot = {
  content: string;
  trace: TaskTraceStep[];
  elapsedMs: number;
};

export type AnswerVersion = AnswerSnapshot & {
  id: string;
  kind: "preview" | "final";
  number: number;
  createdAt: number;
  receivedAt: number;
};

export type AnswerHistory = {
  runId: string;
  submittedAt: number;
  status: "running" | "completed" | "stopped" | "failed";
  versions: AnswerVersion[];
  selectedId: string;
  nextPreviewNumber: number;
  pendingRequestId?: string;
  queryError?: string;
};

export type ProgressRequest = {
  runId: string;
  requestId: string;
  version: AnswerVersion;
};

const copySnapshot = (snapshot: AnswerSnapshot): AnswerSnapshot => ({
  ...snapshot,
  trace: snapshot.trace.map((step) => ({ ...step })),
});

export function createAnswerHistory(runId: string, submittedAt: number): AnswerHistory {
  const id = `${runId}:preview:1`;
  return {
    runId,
    submittedAt,
    status: "running",
    versions: [{
      id,
      kind: "preview",
      number: 1,
      createdAt: submittedAt,
      receivedAt: submittedAt,
      content: "任务已提交，正在后台分析。完成后将自动更新为最终结果，也可通过右上方按钮查询最新进度。",
      trace: [],
      elapsedMs: 0,
    }],
    selectedId: id,
    nextPreviewNumber: 2,
  };
}

export function latestAnswerVersion(history: AnswerHistory): AnswerVersion {
  return history.versions.find((version) => version.kind === "final") ??
    history.versions.reduce((latest, version) => version.number > latest.number ? version : latest);
}

export function selectedAnswerVersion(history: AnswerHistory): AnswerVersion {
  return history.versions.find((version) => version.id === history.selectedId) ?? latestAnswerVersion(history);
}

export function beginProgressQuery(
  history: AnswerHistory,
  snapshot: AnswerSnapshot,
  requestId: string,
  requestedAt: number,
): { history: AnswerHistory; request: ProgressRequest } | undefined {
  if (history.status !== "running" || history.pendingRequestId) return;
  const number = history.nextPreviewNumber;
  return {
    history: { ...history, nextPreviewNumber: number + 1, pendingRequestId: requestId, queryError: undefined },
    request: {
      runId: history.runId,
      requestId,
      version: {
        ...copySnapshot(snapshot),
        id: `${history.runId}:preview:${number}`,
        kind: "preview",
        number,
        createdAt: requestedAt,
        receivedAt: requestedAt,
      },
    },
  };
}

// A pull captures a point-in-time preview. A final push arriving first must not
// turn that in-flight preview into a final result or downgrade the selection.
export function receiveProgressQuery(history: AnswerHistory, request: ProgressRequest, receivedAt: number): AnswerHistory {
  if (history.runId !== request.runId || history.pendingRequestId !== request.requestId) return history;
  if (history.status === "stopped" || history.status === "failed") return history;
  const versions = [...history.versions, { ...request.version, receivedAt }];
  const next = { ...history, versions, pendingRequestId: undefined, queryError: undefined };
  return { ...next, selectedId: latestAnswerVersion(next).id };
}

export function failProgressQuery(history: AnswerHistory, request: ProgressRequest): AnswerHistory {
  if (history.runId !== request.runId || history.pendingRequestId !== request.requestId) return history;
  return { ...history, pendingRequestId: undefined, queryError: "进度查询失败，已保留当前结果，请重试。" };
}

export function completeAnswerHistory(history: AnswerHistory, snapshot: AnswerSnapshot, completedAt: number): AnswerHistory {
  if (history.status !== "running") return history;
  const id = `${history.runId}:final`;
  return {
    ...history,
    status: "completed",
    selectedId: id,
    queryError: undefined,
    versions: [...history.versions, {
      ...copySnapshot(snapshot), id, kind: "final", number: 0,
      createdAt: completedAt, receivedAt: completedAt,
    }],
  };
}

export function stopAnswerHistory(history: AnswerHistory, status: "stopped" | "failed"): AnswerHistory {
  if (history.status !== "running") return history;
  return { ...history, status, pendingRequestId: undefined, queryError: undefined };
}

export function selectAnswerVersion(history: AnswerHistory, id: string): AnswerHistory {
  return history.versions.some((version) => version.id === id) ? { ...history, selectedId: id } : history;
}

// This demo has no backend. Replace this adapter with a progress endpoint when
// integrating the service; the immutable request snapshot exercises late replies.
export function queryDemoProgress(request: ProgressRequest): Promise<ProgressRequest> {
  return new Promise((resolve) => setTimeout(() => resolve(request), 1_800));
}
