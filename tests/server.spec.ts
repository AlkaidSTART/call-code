import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import {
  startServer,
  type ServerInstance,
  type WebExport,
  SessionStore,
} from "@call-code/server";

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

const servers: ServerInstance[] = [];

const createTestServer = async () => {
  const store = new SessionStore({ dbPath: ":memory:" });
  const server = await startServer({ store, port: 0 });
  servers.push(server);
  return { server, store };
};

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.close();
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

describe("Server SDK 与集成服务", () => {
  it("通过 Server SDK 启动服务并响应 sessions.list", async () => {
    const { server, store } = await createTestServer();
    store.createSession({ cwd: "/tmp/sdk-test", id: "s-sdk-1" });
    store.appendEntry("s-sdk-1", {
      id: "e-sdk-1",
      type: "user",
      payload: { role: "user", content: "hello server sdk" },
    });
    store.updateStats("s-sdk-1", {
      messageCount: 1,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    });

    const data = await requestSnapshot(`ws://${server.host}:${server.port}/ws`);

    expect(data.schemaVersion).toBe(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe("s-sdk-1");
    expect(data.sessions[0].entries[0].text).toBe("hello server sdk");
  });

  it("通过 Server SDK 接收 chat.send 并触发 Agent 执行", async () => {
    const { server } = await createTestServer();
    const statuses: unknown[] = [];
    let snapshotReceived: WebExport | null = null;

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://${server.host}:${server.port}/ws`);
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new Error("等待任务执行超时"));
      }, 4000);

      socket.on("open", () => {
        socket.send(
          JSON.stringify({
            type: "chat.send",
            input: "测试 SDK 调用",
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

  it("通过 Server SDK 的 runTask 直接驱动 Agent 并写入会话", async () => {
    const { server } = await createTestServer();

    const result = await server.runTask("SDK runTask 调用", {
      mode: "build",
      workspace: "/tmp/sdk-run",
    });

    expect(result).toBe("已处理完毕");
    const data = server.snapshot();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].cwd).toBe("/tmp/sdk-run");
    expect(
      data.sessions[0].entries.some((entry) => entry.text === "已处理完毕"),
    ).toBe(true);
  });
});
