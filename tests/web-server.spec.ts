import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { SessionStore } from "../packages/session-sqlite/src/index";
import type { WebExport } from "../packages/agent-core/src/web/export";

vi.mock("../packages/agent-core/src/harness/runtime/run-loop", () => ({
  runLoop: vi.fn(async (task, handlers, options) => {
    handlers?.onTrace?.("正在检索本地上下文");
    if (options?.persist && options?.sessionStore) {
      const store = options.sessionStore;
      store.createSession({ id: task.id, cwd: task.workspace || "/tmp" });
      store.appendEntry(task.id, {
        type: "assistant",
        payload: { role: "assistant", content: "已处理完毕" },
      });
    }
    return "已处理完毕";
  }),
}));

import {
  startWebServer,
  type WebServerHandle,
} from "../packages/agent-core/src/web/server";

const stores: SessionStore[] = [];
const handles: WebServerHandle[] = [];

const createServer = async (clientDir?: string) => {
  const store = new SessionStore({ dbPath: ":memory:" });
  stores.push(store);
  const handle = await startWebServer({ store, port: 0, clientDir });
  handles.push(handle);
  return { store, handle };
};

afterEach(async () => {
  for (const handle of handles.splice(0)) {
    await handle.close();
  }
  for (const store of stores.splice(0)) {
    store.close();
  }
});

const requestSnapshot = (url: string): Promise<WebExport> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("等待会话快照超时"));
    }, 3000);

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "sessions.list" }));
    });
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw)) as {
        type?: string;
        data?: WebExport;
      };
      if (message.type === "sessions.snapshot" && message.data) {
        clearTimeout(timeout);
        socket.close();
        resolve(message.data);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

describe("WebSocket 会话服务", () => {
  it("响应 sessions.list 并返回完整会话快照", async () => {
    const { store, handle } = await createServer();
    store.createSession({ cwd: "/tmp/project", id: "s-live" });
    store.appendEntry("s-live", {
      id: "e1",
      type: "user",
      payload: { role: "user", content: "hello ws" },
    });
    store.updateStats("s-live", {
      messageCount: 1,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    const data = await requestSnapshot(`ws://127.0.0.1:${handle.port}/ws`);

    expect(data.schemaVersion).toBe(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].entries[0].text).toBe("hello ws");
  });

  it("响应 chat.send 并触发 harness 执行回传状态与快照", async () => {
    const { handle } = await createServer();
    const statuses: unknown[] = [];
    let snapshotReceived: WebExport | null = null;

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${handle.port}/ws`);
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error("等待任务执行超时"));
      }, 4000);

      socket.on("open", () => {
        socket.send(
          JSON.stringify({
            type: "chat.send",
            input: "重构页面",
            mode: "build",
          }),
        );
      });

      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as {
          type?: string;
          status?: string;
          data?: WebExport;
        };
        if (message.type === "chat.status") {
          statuses.push(message);
          if (message.status === "success" && snapshotReceived) {
            clearTimeout(timeout);
            socket.close();
            resolve();
          }
        } else if (message.type === "sessions.snapshot" && message.data) {
          snapshotReceived = message.data;
          if (statuses.some((s: any) => s.status === "success")) {
            clearTimeout(timeout);
            socket.close();
            resolve();
          }
        }
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(statuses.length).toBeGreaterThanOrEqual(2);
    expect(snapshotReceived).not.toBeNull();
    expect((snapshotReceived as unknown as WebExport).sessions.length).toBeGreaterThan(0);
  });

  it("无法解析的消息返回 error 响应", async () => {
    const { handle } = await createServer();
    const message = await new Promise<unknown>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${handle.port}/ws`);
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error("等待错误响应超时"));
      }, 3000);

      socket.on("open", () => {
        socket.send("not json");
      });
      socket.on("message", (raw) => {
        clearTimeout(timeout);
        socket.close();
        resolve(JSON.parse(String(raw)));
      });
      socket.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(message).toMatchObject({ type: "error" });
  });

  it("HTTP 服务返回客户端页面并支持 SPA 回退", async () => {
    const dir = mkdtempSync(join(tmpdir(), "call-code-web-client-"));
    writeFileSync(join(dir, "index.html"), "<h1>Call Code Web</h1>");

    try {
      const { handle } = await createServer(dir);
      const home = await fetch(`http://127.0.0.1:${handle.port}/`);
      expect(home.status).toBe(200);
      expect(await home.text()).toContain("Call Code Web");

      const fallback = await fetch(
        `http://127.0.0.1:${handle.port}/some/route`,
      );
      expect(fallback.status).toBe(200);
      expect(await fallback.text()).toContain("Call Code Web");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
