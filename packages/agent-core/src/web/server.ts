import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { runLoop } from "../harness/runtime/run-loop.js";
import { createTaskState } from "../harness/core/state.js";
import { buildWebExport, type WebStore } from "./export.js";
import { parseClientMessage, type WebSocketServerMessage } from "./protocol.js";

const DEFAULT_CLIENT_DIR = fileURLToPath(
  new URL("../../../client/dist", import.meta.url),
);
const DEFAULT_PORT = 4173;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export interface WebServerOptions {
  store: WebStore;
  clientDir?: string;
  host?: string;
  port?: number;
}

export interface WebServerHandle {
  host: string;
  port: number;
  close(): Promise<void>;
}

const sendJson = (socket: WebSocket, message: WebSocketServerMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcast = (wss: WebSocketServer, message: WebSocketServerMessage) => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const safePath = (root: string, pathname: string): string | null => {
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }
  return candidate;
};

const serveFile = async (
  res: ServerResponse,
  target: string,
  headOnly: boolean,
): Promise<boolean> => {
  try {
    const info = await stat(target);
    if (!info.isFile()) {
      return false;
    }

    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(target)] ?? "application/octet-stream",
      "Content-Length": content.length,
    });
    res.end(headOnly ? undefined : content);
    return true;
  } catch {
    return false;
  }
};

const serveStatic = async (
  req: IncomingMessage,
  res: ServerResponse,
  clientDir: string,
): Promise<void> => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  let pathname = "/";
  try {
    pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  const root = resolve(clientDir);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = safePath(root, requested);
  if (!filePath) {
    res.writeHead(404);
    res.end();
    return;
  }

  const headOnly = req.method === "HEAD";
  if (await serveFile(res, filePath, headOnly)) {
    return;
  }

  // 单页应用回退到入口页，避免刷新子路由时 404
  const fallback = join(root, "index.html");
  if (await serveFile(res, fallback, headOnly)) {
    return;
  }

  res.writeHead(404);
  res.end();
};

/**
 * 启动 Web 会话面板：静态托管客户端构建产物，并在 /ws 提供会话快照与 Harness 调度。
 */
export const startWebServer = async (
  options: WebServerOptions,
): Promise<WebServerHandle> => {
  const store = options.store;
  const clientDir = options.clientDir ?? DEFAULT_CLIENT_DIR;
  const host = options.host ?? "127.0.0.1";
  const port =
    options.port ?? Number(process.env.CALL_CODE_WEB_PORT ?? DEFAULT_PORT);

  let isRunning = false;

  const httpServer = createServer((req, res) => {
    void serveStatic(req, res, clientDir);
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.on("message", async (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString();
      const message = parseClientMessage(text);
      if (!message) {
        sendJson(socket, { type: "error", message: "无法解析请求消息" });
        return;
      }

      if (message.type === "sessions.list") {
        sendJson(socket, {
          type: "sessions.snapshot",
          data: buildWebExport(store),
        });
        return;
      }

      if (message.type === "sessions.delete") {
        if (message.entryIds && message.entryIds.length > 0) {
          store.deleteEntries(message.sessionId, message.entryIds);
        } else {
          store.deleteSession(message.sessionId);
        }
        broadcast(wss, {
          type: "sessions.snapshot",
          data: buildWebExport(store),
        });
        return;
      }

      if (message.type === "chat.send") {
        if (isRunning) {
          sendJson(socket, {
            type: "chat.status",
            status: "error",
            message: "当前已有正在运行的任务，请稍候...",
          });
          return;
        }

        isRunning = true;
        broadcast(wss, {
          type: "chat.status",
          status: "running",
          trace: `任务已启动（模式: ${(message.mode ?? "build").toUpperCase()}）`,
        });

        try {
          const task = createTaskState(message.input, {
            mode: message.mode ?? "build",
            objective: message.objective,
            constraints: message.constraints,
            workspace: message.workspace ?? process.cwd(),
          });

          await runLoop(
            task,
            {
              onTrace: (traceText) => {
                broadcast(wss, {
                  type: "chat.status",
                  status: "running",
                  trace: traceText,
                });
              },
              onError: (err) => {
                const errMsg = err instanceof Error ? err.message : String(err);
                broadcast(wss, {
                  type: "chat.status",
                  status: "error",
                  message: errMsg,
                });
              },
            },
            { persist: true, sessionStore: store },
          );

          broadcast(wss, {
            type: "chat.status",
            status: "success",
            trace: "任务完成",
          });
          broadcast(wss, {
            type: "sessions.snapshot",
            data: buildWebExport(store),
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          broadcast(wss, {
            type: "chat.status",
            status: "error",
            message: errMsg,
          });
        } finally {
          isRunning = false;
        }
      }
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(port, host, () => {
      httpServer.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("无法获取 Web 服务端口");
  }

  return {
    host,
    port: address.port,
    async close() {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolveClose) => {
        wss.close(() => resolveClose());
      });
      await new Promise<void>((resolveClose, rejectClose) => {
        httpServer.close((error) => {
          if (error) {
            rejectClose(error);
          } else {
            resolveClose();
          }
        });
      });
    },
  };
};
