import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderBar } from "../packages/client/src/components/HeaderBar";
import { MainPanel } from "../packages/client/src/components/MainPanel";
import { Sidebar } from "../packages/client/src/components/Sidebar";
import { ConfirmDialog } from "../packages/client/src/components/ConfirmDialog";
import type { WebSession } from "../packages/client/src/types";

vi.mock("../packages/client/assets/call-code.png", () => ({
  default: "call-code.png",
}));

const makeSession = (overrides: Partial<WebSession> = {}): WebSession => ({
  id: "s1",
  createdAt: "2026-08-05T00:00:00.000Z",
  cwd: "/tmp/project",
  parentSessionId: null,
  metadata: {},
  stats: {
    messageCount: 2,
    cachedTokens: 0,
    uncachedTokens: 0,
    totalTokens: 0,
    costTotal: 0,
  },
  entries: [
    {
      seq: 1,
      id: "e1",
      parentId: null,
      type: "user",
      role: "user",
      timestamp: "2026-08-05T00:00:00.000Z",
      text: "hello world",
      payload: { role: "user", content: "hello world" },
    },
    {
      seq: 2,
      id: "e2",
      parentId: null,
      type: "tool",
      role: "tool",
      timestamp: "2026-08-05T00:00:00.000Z",
      tool: "read_file",
      payload: {},
    },
  ],
  records: [],
  facts: [],
  ...overrides,
});

describe("client HeaderBar", () => {
  it("顶部栏展示产品名、会话统计和主题切换", () => {
    const html = renderToStaticMarkup(
      React.createElement(HeaderBar, {
        sessions: [makeSession()],
        theme: "dark",
        onThemeChange: () => undefined,
      }),
    );

    expect(html).toContain("Call Code");
    expect(html).toContain("1 个会话");
    expect(html).toContain("2 条消息");
    expect(html).toContain("1 次工具");
    expect(html).toContain("浅色");
    expect(html).toContain("深色");
  });

  it("统计按多个会话累加", () => {
    const second = makeSession({ id: "s2" });
    const html = renderToStaticMarkup(
      React.createElement(HeaderBar, {
        sessions: [makeSession(), second],
        theme: "light",
        onThemeChange: () => undefined,
      }),
    );

    expect(html).toContain("2 个会话");
    expect(html).toContain("4 条消息");
    expect(html).toContain("2 次工具");
    expect(html).toContain("浅色");
  });

  it("服务未连接时仍显示完整界面状态", () => {
    const html = renderToStaticMarkup(
      React.createElement(HeaderBar, {
        sessions: [],
        theme: "light",
        connectionState: "error",
        onThemeChange: () => undefined,
      }),
    );

    expect(html).toContain("Call Code");
    expect(html).toContain("等待会话服务");
    expect(html).toContain("浅色");
  });
});

describe("client MainPanel", () => {
  it("渲染输入框、模式选择与发送按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(MainPanel, {
        session: makeSession(),
        filter: "all",
        onFilterChange: () => undefined,
        onDeleteEntry: () => undefined,
        chatStatus: { status: "idle" },
        onSendMessage: () => true,
        onCompactSession: () => undefined,
      }),
    );

    expect(html).toContain("BUILD");
    expect(html).toContain("PLAN");
    expect(html).toContain("发送");
    expect(html).toContain("hello world");
    expect(html).toContain("压缩上下文");
    expect(html).not.toContain('aria-label="压缩会话上下文" disabled=""');
  });

  it("展示任务运行中的 trace 状态", () => {
    const html = renderToStaticMarkup(
      React.createElement(MainPanel, {
        session: makeSession(),
        filter: "all",
        onFilterChange: () => undefined,
        onDeleteEntry: () => undefined,
        chatStatus: { status: "running", trace: "正在执行工具调用..." },
        onSendMessage: () => true,
        onCompactSession: () => undefined,
      }),
    );

    expect(html).toContain("正在执行工具调用...");
    expect(html).toContain('aria-label="压缩会话上下文" disabled=""');
  });

  it("不渲染 system 输出（压缩摘要）", () => {
    const session = makeSession({
      entries: [
        ...makeSession().entries,
        {
          seq: 3,
          id: "e3",
          parentId: null,
          type: "compaction",
          role: "system",
          timestamp: "2026-08-05T00:00:00.000Z",
          text: "手动压缩摘要",
          payload: { summary: "手动压缩摘要" },
        },
      ],
    });
    const html = renderToStaticMarkup(
      React.createElement(MainPanel, {
        session,
        filter: "all",
        onFilterChange: () => undefined,
        onDeleteEntry: () => undefined,
        chatStatus: { status: "idle" },
        onSendMessage: () => true,
        onCompactSession: () => undefined,
      }),
    );

    expect(html).not.toContain("手动压缩摘要");
    expect(html).not.toContain(">系统<");
  });

  it("没有会话时禁用压缩入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(MainPanel, {
        session: null,
        filter: "all",
        onFilterChange: () => undefined,
        onDeleteEntry: () => undefined,
        chatStatus: { status: "idle" },
        onSendMessage: () => true,
        onCompactSession: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="压缩会话上下文" disabled=""');
  });
});

describe("client Sidebar", () => {
  it("每个会话都渲染删除入口", () => {
    const sessions = [makeSession(), makeSession({ id: "s2", entries: [] })];
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        sessions,
        activeId: "s1",
        query: "",
        onSelect: () => undefined,
        onQueryChange: () => undefined,
        onDeleteSession: () => undefined,
        onNewTopic: () => undefined,
      }),
    );

    expect(html).toContain("开启新话题");
    expect(html.match(/aria-label="删除会话/g)).toHaveLength(2);
    expect(html).toContain('title="删除会话"');
    expect(html).toContain('aria-label="删除会话 hello world"');
    expect(html).toContain('aria-label="删除会话 新会话"');
  });

  it("顶部提供开启新话题入口", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        sessions: [makeSession()],
        activeId: "s1",
        query: "",
        onSelect: () => undefined,
        onQueryChange: () => undefined,
        onDeleteSession: () => undefined,
        onNewTopic: () => undefined,
      }),
    );

    expect(html).toContain("开启新话题");
    expect(html).toContain('type="button"');
  });
});

describe("client ConfirmDialog", () => {
  it("渲染删除确认标题、说明和操作按钮", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        open: true,
        title: "删除会话",
        description: "删除整个会话？此操作无法撤销。",
        onConfirm: () => undefined,
        onCancel: () => undefined,
      }),
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("删除会话");
    expect(html).toContain("删除整个会话？此操作无法撤销。");
    expect(html).toContain("取消");
    expect(html).toContain("删除");
  });

  it("未打开时不渲染对话框", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        open: false,
        title: "删除会话",
        description: "删除整个会话？此操作无法撤销。",
        onConfirm: () => undefined,
        onCancel: () => undefined,
      }),
    );

    expect(html).toBe("");
  });
});
