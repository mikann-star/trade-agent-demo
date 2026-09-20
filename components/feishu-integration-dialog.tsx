"use client";

import {
  Check,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  completeFeishuExternalAction,
  FEISHU_INTEGRATION_STORAGE_KEY,
  FEISHU_OPEN_PLATFORM_URL,
  initialFeishuIntegrationState,
  notifyFeishuIntegrationChanged,
  parseFeishuIntegrationState,
  type FeishuExternalAction,
  type FeishuIntegrationState,
} from "@/lib/feishu-integration";

type FeishuIntegrationDialogProps = {
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
  onTryNow: () => void;
};

export function FeishuIntegrationDialog({
  open,
  onClose,
  onToast,
  onTryNow,
}: FeishuIntegrationDialogProps) {
  const [integration, setIntegration] = useState<FeishuIntegrationState>(() =>
    typeof window === "undefined"
      ? initialFeishuIntegrationState
      : parseFeishuIntegrationState(
          window.localStorage.getItem(FEISHU_INTEGRATION_STORAGE_KEY),
        ),
  );
  const [unlinkConfirmationOpen, setUnlinkConfirmationOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const unlinkCancelRef = useRef<HTMLButtonElement | null>(null);
  const integrationRef = useRef(integration);
  const leftPageRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const persist = useCallback((next: FeishuIntegrationState) => {
    integrationRef.current = next;
    setIntegration(next);
    window.localStorage.setItem(
      FEISHU_INTEGRATION_STORAGE_KEY,
      JSON.stringify(next),
    );
    notifyFeishuIntegrationChanged();
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, [open]);

  const closeDialog = () => {
    const current = integrationRef.current;
    if (current.appId && current.appSecret && current.step === 1) {
      persist({ ...current, step: 2 });
    }
    onClose();
  };

  const resolvePendingAction = useCallback(() => {
    const current = integrationRef.current;
    if (!current.pendingExternalAction) return;
    leftPageRef.current = false;
    if (completionTimerRef.current) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const result = completeFeishuExternalAction(current);
    persist(result.state);
    if (result.toast) onToast(result.toast);
  }, [onToast, persist]);

  const completePendingAction = useCallback(() => {
    if (!leftPageRef.current) return;
    if (completionTimerRef.current) {
      window.clearTimeout(completionTimerRef.current);
    }
    completionTimerRef.current = window.setTimeout(resolvePendingAction, 650);
  }, [resolvePendingAction]);

  useEffect(() => {
    if (!open) return;

    const markPageLeft = () => {
      if (integrationRef.current.pendingExternalAction) {
        leftPageRef.current = true;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        markPageLeft();
      } else {
        completePendingAction();
      }
    };

    window.addEventListener("blur", markPageLeft);
    window.addEventListener("focus", completePendingAction);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", markPageLeft);
      window.removeEventListener("focus", completePendingAction);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [completePendingAction, open]);

  useEffect(
    () => () => {
      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
      }
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    },
    [],
  );

  const beginExternalAction = (action: Exclude<FeishuExternalAction, null>) => {
    leftPageRef.current = false;
    persist({ ...integrationRef.current, pendingExternalAction: action });
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = window.setTimeout(resolvePendingAction, 4_000);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (unlinkConfirmationOpen) {
        setUnlinkConfirmationOpen(false);
      } else {
        closeDialog();
      }
      return;
    }
    if (event.key !== "Tab" || unlinkConfirmationOpen) return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  const requestUnlink = () => {
    setUnlinkConfirmationOpen(true);
    requestAnimationFrame(() => unlinkCancelRef.current?.focus());
  };

  const confirmUnlink = () => {
    window.localStorage.removeItem(FEISHU_INTEGRATION_STORAGE_KEY);
    notifyFeishuIntegrationChanged();
    integrationRef.current = initialFeishuIntegrationState;
    setIntegration(initialFeishuIntegrationState);
    setUnlinkConfirmationOpen(false);
    onToast("已解除飞书授权");
  };

  if (!open) return null;

  const waitingForCreation = integration.pendingExternalAction === "create";
  const waitingForAuthorization =
    integration.pendingExternalAction === "authorize";

  return (
    <div className="feishu-integration-layer">
      <button
        aria-label="关闭飞书授权"
        className="feishu-integration-scrim"
        onClick={closeDialog}
        type="button"
      />
      <section
        aria-labelledby="feishu-integration-title"
        aria-modal="true"
        className="feishu-integration-dialog"
        inert={unlinkConfirmationOpen ? true : undefined}
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <header className="feishu-integration-header">
          <div>
            <h2 id="feishu-integration-title">飞书授权</h2>
            <p>
              授权后，交易智能助手可连接你的飞书消息、云文档、多维表格、会议等核心功能。
            </p>
          </div>
          <button
            aria-label="关闭"
            onClick={closeDialog}
            ref={closeButtonRef}
            type="button"
          >
            <X size={21} />
          </button>
        </header>

        <div aria-label="授权进度" className="feishu-integration-steps">
          <div
            className={`feishu-integration-step ${integration.step === 1 ? "active" : "completed"}`}
          >
            <span>{integration.step === 2 ? <Check size={15} /> : "1"}</span>
            <strong>绑定飞书应用</strong>
          </div>
          <span aria-hidden="true" className="feishu-integration-step-line" />
          <div
            className={`feishu-integration-step ${integration.step === 2 ? "active" : ""} ${integration.authorized ? "completed" : ""}`}
          >
            <span>{integration.authorized ? <Check size={15} /> : "2"}</span>
            <strong>完成应用授权</strong>
          </div>
        </div>

        {integration.step === 1 ? (
          <div className="feishu-integration-panel simplified">
            {waitingForCreation ? (
              <FeishuDetectionState
                detail="应用创建后，将自动跳转"
                label="检测应用创建状态..."
              />
            ) : (
              <>
                <p className="feishu-creation-hint">
                  <Info aria-hidden="true" size={18} />
                  <span>点击按钮，自动为您创建并绑定飞书应用。</span>
                </p>
                <a
                  className="feishu-integration-primary"
                  href={FEISHU_OPEN_PLATFORM_URL}
                  onClick={() => beginExternalAction("create")}
                  rel="noreferrer"
                  target="_blank"
                >
                  创建飞书应用
                </a>
              </>
            )}
          </div>
        ) : (
          <div className="feishu-integration-panel simplified">
            {waitingForAuthorization ? (
              <FeishuDetectionState label="检测飞书权限开通状态..." />
            ) : (
              <div className="feishu-authorization-pending">
                <section className="feishu-authorization-card">
                  <header>
                    <strong>应用信息</strong>
                    <span className={integration.authorized ? "authorized" : undefined}>
                      {integration.authorized ? "已授权" : "待授权"}
                    </span>
                  </header>
                  <div>
                    <span>应用 ID</span>
                    <code>{integration.appId}</code>
                  </div>
                </section>
                <footer className="feishu-authorization-actions">
                  <button
                    className="feishu-unlink-button"
                    onClick={requestUnlink}
                    type="button"
                  >
                    解除绑定
                  </button>
                  {integration.authorized ? (
                    <button
                      className="feishu-integration-secondary feishu-try-now-button"
                      onClick={onTryNow}
                      type="button"
                    >
                      立即体验
                    </button>
                  ) : (
                    <a
                      className="feishu-integration-primary"
                      href={FEISHU_OPEN_PLATFORM_URL}
                      onClick={() => beginExternalAction("authorize")}
                      rel="noreferrer"
                      target="_blank"
                    >
                      已创建应用，去授权
                    </a>
                  )}
                </footer>
              </div>
            )}
          </div>
        )}
      </section>

      {unlinkConfirmationOpen ? (
        <div className="feishu-unlink-layer">
          <button
            aria-label="取消解除绑定"
            className="feishu-unlink-scrim"
            onClick={() => setUnlinkConfirmationOpen(false)}
            type="button"
          />
          <section
            aria-labelledby="feishu-unlink-title"
            aria-modal="true"
            className="feishu-unlink-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setUnlinkConfirmationOpen(false);
              }
            }}
            role="alertdialog"
          >
            <h3 id="feishu-unlink-title">解除飞书授权？</h3>
            <p>解除后将清除当前飞书应用配置和授权状态</p>
            <div>
              <button
                onClick={() => setUnlinkConfirmationOpen(false)}
                ref={unlinkCancelRef}
                type="button"
              >
                取消
              </button>
              <button onClick={confirmUnlink} type="button">
                确认解除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function FeishuDetectionState({
  detail,
  label,
}: {
  detail?: string;
  label: string;
}) {
  return (
    <div aria-live="polite" className="feishu-detection-state" role="status">
      <LoaderCircle aria-hidden="true" size={46} />
      <strong>{label}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
