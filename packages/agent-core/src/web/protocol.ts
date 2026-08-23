import type { AgentMode } from "../harness/core/state.js";
import type { WebExport } from "./export.js";

export type ChatSendPayload = {
  type: "chat.send";
  input: string;
  mode?: AgentMode;
  objective?: string;
  constraints?: string[];
  workspace?: string;
};

/** 客户端发给 WebSocket 服务的请求。 */
export type WebSocketClientMessage =
  | { type: "sessions.list" }
  | ChatSendPayload;

/** 服务端发给客户端的响应。 */
export type WebSocketServerMessage =
  | { type: "sessions.snapshot"; data: WebExport }
  | {
      type: "chat.status";
      status: "idle" | "running" | "success" | "error";
      trace?: string;
      message?: string;
    }
  | { type: "error"; message: string };

/** 解析客户端文本消息，格式非法或类型未知时返回 null。 */
export const parseClientMessage = (
  raw: string,
): WebSocketClientMessage | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      return null;
    }

    const message = value as { type?: unknown };
    if (message.type === "sessions.list") {
      return { type: "sessions.list" };
    }

    if (message.type === "chat.send") {
      const rawInput = (message as { input?: unknown }).input;
      if (typeof rawInput !== "string" || !rawInput.trim()) {
        return null;
      }
      const rawMode = (message as { mode?: unknown }).mode;
      const mode: AgentMode = rawMode === "plan" ? "plan" : "build";
      return {
        type: "chat.send",
        input: rawInput.trim(),
        mode,
      };
    }

    return null;
  } catch {
    return null;
  }
};
