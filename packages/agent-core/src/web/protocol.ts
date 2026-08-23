import type { WebExport } from './export';

/** 客户端发给 WebSocket 服务的请求。 */
export type WebSocketClientMessage = {
  type: 'sessions.list';
};

/** 服务端发给客户端的响应。 */
export type WebSocketServerMessage =
  | { type: 'sessions.snapshot'; data: WebExport }
  | { type: 'error'; message: string };

/** 解析客户端文本消息，格式非法或类型未知时返回 null。 */
export const parseClientMessage = (
  raw: string,
): WebSocketClientMessage | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') {
      return null;
    }

    const message = value as { type?: unknown };
    return message.type === 'sessions.list' ? { type: 'sessions.list' } : null;
  } catch {
    return null;
  }
};
