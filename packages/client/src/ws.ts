import type { AgentMode, ChatStatusMessage, WebExport, WebSession } from "./types";

const DEFAULT_WS_PATH = "/ws";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_REFRESH_MS = 5000;

const isWebSession = (value: unknown): value is WebSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<WebSession>;
  return (
    typeof session.id === "string" &&
    typeof session.createdAt === "string" &&
    typeof session.cwd === "string" &&
    Array.isArray(session.entries)
  );
};

export const isWebExport = (value: unknown): value is WebExport => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<WebExport>;
  return (
    data.schemaVersion === 1 &&
    typeof data.exportedAt === "string" &&
    Array.isArray(data.sessions) &&
    data.sessions.every(isWebSession)
  );
};

/** 从服务端消息中提取会话快照，类型不符或结构非法时返回 null。 */
export const parseSnapshotMessage = (value: unknown): WebExport | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as { type?: unknown; data?: unknown };
  if (message.type !== "sessions.snapshot") {
    return null;
  }
  return isWebExport(message.data) ? message.data : null;
};

export const parseChatStatusMessage = (value: unknown): ChatStatusMessage | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as { type?: unknown; status?: unknown; trace?: unknown; message?: unknown };
  if (message.type !== "chat.status") {
    return null;
  }

  const status = message.status;
  if (status !== "idle" && status !== "running" && status !== "success" && status !== "error") {
    return null;
  }

  return {
    status,
    trace: typeof message.trace === "string" ? message.trace : undefined,
    message: typeof message.message === "string" ? message.message : undefined,
  };
};

const resolveWsUrl = (override?: string): string => {
  if (override) {
    return override;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("ws") ?? params.get("wsUrl");
  if (fromQuery) {
    return fromQuery;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${DEFAULT_WS_PATH}`;
};

export interface LiveExportOptions {
  url?: string;
  timeoutMs?: number;
  refreshMs?: number;
  onSnapshot: (data: WebExport) => void;
  onChatStatus?: (status: ChatStatusMessage) => void;
}

export interface LiveExportConnection {
  ready: Promise<WebExport | null>;
  sendMessage: (payload: { input: string; mode?: AgentMode }) => boolean;
  refresh: () => void;
  close(): void;
}

/**
 * 连接 WebSocket 会话服务：连接成功后立即拉取快照，之后按 refreshMs 周期性刷新。
 * 断开时自动退避重连，支持发送 chat.send 消息触发 harness。
 */
export const connectLiveExport = (
  options: LiveExportOptions,
): LiveExportConnection => {
  const {
    onSnapshot,
    onChatStatus,
    url,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    refreshMs = DEFAULT_REFRESH_MS,
  } = options;

  let closed = false;
  let socket: WebSocket | null = null;
  let failTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let readySettled = false;
  let resolveReady: (value: WebExport | null) => void = () => undefined;

  const ready = new Promise<WebExport | null>((resolve) => {
    resolveReady = resolve;
  });

  const settleReady = (value: WebExport | null) => {
    if (readySettled) {
      return;
    }
    readySettled = true;
    resolveReady(value);
  };

  const clearTimers = () => {
    if (failTimer) {
      clearTimeout(failTimer);
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    failTimer = null;
    refreshTimer = null;
    retryTimer = null;
  };

  const teardownSocket = () => {
    clearTimers();
    if (!socket) {
      return;
    }

    const current = socket;
    socket = null;
    current.onopen = null;
    current.onmessage = null;
    current.onerror = null;
    current.onclose = null;
    current.close();
  };

  const scheduleRefresh = () => {
    if (closed) {
      return;
    }
    refreshTimer = setTimeout(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "sessions.list" }));
      }
      scheduleRefresh();
    }, refreshMs);
  };

  const scheduleReconnect = () => {
    if (closed) {
      return;
    }

    const delay = Math.min(1000 * 2 ** attempt, 15000);
    attempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      openSocket();
    }, delay);
  };

  const armTimeout = () => {
    if (failTimer) {
      clearTimeout(failTimer);
    }
    failTimer = setTimeout(() => {
      teardownSocket();
      settleReady(null);
      scheduleReconnect();
    }, timeoutMs);
  };

  const openSocket = () => {
    if (closed) {
      return;
    }

    let current: WebSocket;
    try {
      current = new WebSocket(resolveWsUrl(url));
    } catch {
      scheduleReconnect();
      return;
    }
    socket = current;
    armTimeout();

    current.onopen = () => {
      attempt = 0;
      current.send(JSON.stringify({ type: "sessions.list" }));
      scheduleRefresh();
    };

    current.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const chatStatus = parseChatStatusMessage(parsed);
      if (chatStatus) {
        onChatStatus?.(chatStatus);
        return;
      }

      const data = parseSnapshotMessage(parsed);
      if (!data) {
        return;
      }

      armTimeout();
      onSnapshot(data);
      settleReady(data);
    };

    current.onerror = () => {
      // 关闭事件统一负责清理与重连
    };

    current.onclose = () => {
      if (socket !== current) {
        return;
      }
      teardownSocket();
      settleReady(null);
      if (!closed) {
        scheduleReconnect();
      }
    };
  };

  openSocket();

  return {
    ready,
    sendMessage(payload) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      socket.send(
        JSON.stringify({
          type: "chat.send",
          input: payload.input,
          mode: payload.mode ?? "build",
        }),
      );
      return true;
    },
    refresh() {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "sessions.list" }));
      }
    },
    close() {
      closed = true;
      clearTimers();
      teardownSocket();
    },
  };
};
