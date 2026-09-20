export const FEISHU_INTEGRATION_STORAGE_KEY =
  "trade-agent-feishu-integration-v1";
export const FEISHU_INTEGRATION_CHANGE_EVENT =
  "trade-agent-feishu-integration-change";

export const FEISHU_OPEN_PLATFORM_URL = "https://open.feishu.cn/app";

export type FeishuIntegrationStep = 1 | 2;
export type FeishuExternalAction = "create" | "authorize" | null;

export type FeishuIntegrationState = {
  step: FeishuIntegrationStep;
  linkRevealed: boolean;
  appId: string;
  appSecret: string;
  authorized: boolean;
  pendingExternalAction: FeishuExternalAction;
};

export const initialFeishuIntegrationState: FeishuIntegrationState = {
  step: 1,
  linkRevealed: false,
  appId: "",
  appSecret: "",
  authorized: false,
  pendingExternalAction: null,
};

export function getFeishuIntegrationStorageSnapshot() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(FEISHU_INTEGRATION_STORAGE_KEY);
}

export function subscribeToFeishuIntegration(
  listener: () => void,
): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === FEISHU_INTEGRATION_STORAGE_KEY) listener();
  };
  window.addEventListener(FEISHU_INTEGRATION_CHANGE_EVENT, listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(FEISHU_INTEGRATION_CHANGE_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function notifyFeishuIntegrationChanged() {
  window.dispatchEvent(new Event(FEISHU_INTEGRATION_CHANGE_EVENT));
}

export function parseFeishuIntegrationState(
  storedValue: string | null,
): FeishuIntegrationState {
  if (!storedValue) return initialFeishuIntegrationState;

  try {
    const parsed = JSON.parse(storedValue) as Partial<FeishuIntegrationState>;
    const appId = typeof parsed.appId === "string" ? parsed.appId : "";
    const appSecret =
      typeof parsed.appSecret === "string" ? parsed.appSecret : "";
    const hasCredentials = Boolean(appId && appSecret);

    return {
      step: hasCredentials || parsed.step === 2 ? 2 : 1,
      linkRevealed: Boolean(parsed.linkRevealed || hasCredentials),
      appId,
      appSecret,
      authorized: Boolean(parsed.authorized && hasCredentials),
      pendingExternalAction:
        parsed.pendingExternalAction === "create" ||
        parsed.pendingExternalAction === "authorize"
          ? parsed.pendingExternalAction
          : null,
    };
  } catch {
    return initialFeishuIntegrationState;
  }
}

export function createDemoFeishuCredentials(seed = crypto.randomUUID()) {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const suffix = (compact || "manbo2026").padEnd(24, "0");
  return {
    appId: `cli_demo_${suffix.slice(0, 12)}`,
    appSecret: `demo_${suffix.slice(0, 24)}_secret`,
  };
}

export function completeFeishuExternalAction(
  state: FeishuIntegrationState,
  seed?: string,
): { state: FeishuIntegrationState; toast: string } {
  if (state.pendingExternalAction === "create") {
    const credentials = createDemoFeishuCredentials(seed);
    return {
      state: {
        ...state,
        ...credentials,
        step: 2,
        linkRevealed: true,
        pendingExternalAction: null,
      },
      toast: "飞书应用创建成功，请继续开通飞书权限",
    };
  }

  if (state.pendingExternalAction === "authorize") {
    return {
      state: {
        ...state,
        step: 2,
        authorized: true,
        pendingExternalAction: null,
      },
      toast: "飞书授权成功，完整能力已解锁",
    };
  }

  return { state, toast: "" };
}
