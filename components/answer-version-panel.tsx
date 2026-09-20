import { ChevronDown, History, LoaderCircle, RotateCcw } from "lucide-react";
import {
  latestAnswerVersion,
  selectedAnswerVersion,
  type AnswerHistory,
  type AnswerVersion,
} from "@/lib/answer-versions";

function versionName(version: AnswerVersion) {
  return version.kind === "final" ? "最终版" : `预览版${version.number}`;
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
}

export function AnswerVersionPanel({ history, onSelect, onQueryProgress }: {
  history: AnswerHistory;
  onSelect: (id: string) => void;
  onQueryProgress: () => void;
}) {
  const current = selectedAnswerVersion(history);
  const latest = latestAnswerVersion(history);
  const isHistory = current.id !== latest.id;
  const ordered = [...history.versions].sort((a, b) =>
    a.kind !== b.kind ? (a.kind === "final" ? -1 : 1) : b.number - a.number,
  );
  const stopped = history.status === "stopped" || history.status === "failed";
  const querying = history.status === "running" && Boolean(history.pendingRequestId);

  return (
    <div className="answer-version-panel">
      <div className="answer-version-heading">
        <label className={`answer-version-picker ${current.kind}`}>
          <History size={14} aria-hidden="true" />
          <span>{versionName(current)}</span>
          <ChevronDown size={12} aria-hidden="true" />
          <select aria-label="查看回复版本" value={current.id} onChange={(event) => onSelect(event.target.value)}>
            {ordered.map((version) => <option key={version.id} value={version.id}>
              {versionName(version)} · {timeLabel(version.kind === "final" ? history.submittedAt : version.createdAt)} ～ {timeLabel(version.receivedAt)}
            </option>)}
          </select>
        </label>
        <button
          className="query-progress-button"
          type="button"
          disabled={history.status !== "running" || Boolean(history.pendingRequestId)}
          title={history.status === "completed" ? "任务已完成，无需再次查询" : stopped ? "任务已结束" : "获取最新执行进度并保存预览版"}
          onClick={onQueryProgress}
        >
          {querying
            ? <LoaderCircle size={14} className="progress-query-spinner" aria-hidden="true" />
            : <RotateCcw size={14} aria-hidden="true" />}
          {querying ? "正在查询…" : "查询任务进度"}
        </button>
      </div>
      {history.queryError && <p className="answer-query-error" role="status">{history.queryError}</p>}
      {isHistory ? (
        <div className="answer-version-notice historical">
          <span>正在查看{versionName(current)} · {timeLabel(current.createdAt)} 的历史快照</span>
          <button type="button" onClick={() => onSelect(latest.id)}><RotateCcw size={12} />返回{versionName(latest)}</button>
        </div>
      ) : current.kind === "preview" && stopped ? (
        <div className="answer-version-notice">
          {history.status === "stopped" ? "任务已停止，以下为已保留的预览结果。" : "任务执行失败，已保留历史预览，可重新生成。"}
        </div>
      ) : null}
    </div>
  );
}
