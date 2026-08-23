import { useState, type KeyboardEvent } from "react";
import type { AgentMode, ChatStatusMessage, Filter, WebFact, WebRecord, WebSession } from "../types";
import { filterEntries, formatTime, getSessionTitle } from "../utils";
import { MessageItem } from "./MessageItem";

interface MainPanelProps {
  session: WebSession | null;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  chatStatus: ChatStatusMessage;
  onSendMessage: (payload: { input: string; mode: AgentMode }) => boolean;
}

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "user", label: "用户" },
  { value: "assistant", label: "助手" },
  { value: "tool", label: "工具" },
];

function StatRow({ session }: { session: WebSession }) {
  const items = [
    ["消息", `${session.entries.length}`],
    ["tokens", session.stats?.totalTokens?.toLocaleString() ?? "0"],
    ["成本", `$${(session.stats?.costTotal ?? 0).toFixed(3)}`],
    ["目录", session.cwd],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(([label, value]) => (
        <span key={label} className="chip max-w-[240px] truncate">
          <span style={{ opacity: 0.6 }}>{label}</span>
          <span className="truncate">{value}</span>
        </span>
      ))}
    </div>
  );
}

function FactGrid({ facts }: { facts: WebFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <div
        className="mb-3 text-[11px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        事实
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.slice(0, 12).map((fact, index) => (
          <div key={`${fact.seq}-${index}`} className="msg-bubble px-3 py-2.5">
            <div
              className="text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {fact.kind}
            </div>
            <div
              className="mt-0.5 truncate text-[13px]"
              style={{ color: "var(--text-primary)" }}
            >
              {fact.value || fact.key || String(fact.seq)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const payloadText = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object") {
    return JSON.stringify(payload, null, 2);
  }
  return String(payload ?? "");
};

function RecordList({ records }: { records: WebRecord[] }) {
  if (records.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <div
        className="mb-3 text-[11px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        运行记录 · 最近 {Math.min(20, records.length)} 条
      </div>
      <div className="flex flex-col gap-1.5">
        {records
          .slice(-20)
          .reverse()
          .map((record) => (
            <div key={record.id} className="msg-bubble px-3 py-2.5">
              <div
                className="flex items-center justify-between gap-2 text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span className="truncate">
                  {record.type}
                  {record.opKind ? ` / ${record.opKind}` : ""}
                </span>
                <span className="shrink-0">{formatTime(record.timestamp)}</span>
              </div>
              <div
                className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words mono"
                style={{ color: "var(--text-secondary)" }}
              >
                {payloadText(record.payload)}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

export function MainPanel({
  session,
  filter,
  onFilterChange,
  chatStatus,
  onSendMessage,
}: MainPanelProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AgentMode>("build");
  const entries = session ? filterEntries(session.entries, filter) : [];

  const handleSend = () => {
    if (!input.trim() || chatStatus.status === "running") {
      return;
    }
    const success = onSendMessage({ input: input.trim(), mode });
    if (success) {
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="main-panel">
      {/* 标题栏 */}
      <header className="flex flex-col gap-3 px-6 pt-5 pb-4">
        <h2
          className="truncate text-[15px] font-semibold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {session ? getSessionTitle(session) : "暂无会话"}
        </h2>
        {session ? <StatRow session={session} /> : null}
      </header>

      {/* 过滤器与模式栏 */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-2.5"
        style={{ borderColor: "rgb(var(--panel-border))" }}
      >
        <div className="segmented" role="tablist" aria-label="消息过滤">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-pressed={filter === item.value}
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="segmented" role="tablist" aria-label="模式选择">
            <button
              type="button"
              role="tab"
              aria-pressed={mode === "build"}
              onClick={() => setMode("build")}
            >
              BUILD
            </button>
            <button
              type="button"
              role="tab"
              aria-pressed={mode === "plan"}
              onClick={() => setMode("plan")}
            >
              PLAN
            </button>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[760px]">
          {!session ? (
            <div
              className="grid min-h-[200px] place-items-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              暂无会话数据，可在下方直接输入需求启动 Harness
            </div>
          ) : entries.length === 0 ? (
            <div
              className="grid min-h-[200px] place-items-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              没有匹配的消息
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <MessageItem key={entry.id} entry={entry} />
              ))}
              {session.facts ? <FactGrid facts={session.facts} /> : null}
              {session.records ? (
                <RecordList records={session.records} />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* 底部输入与运行状态栏 */}
      <footer
        className="border-t px-6 py-3.5"
        style={{ borderColor: "rgb(var(--panel-border))" }}
      >
        <div className="mx-auto flex max-w-[760px] flex-col gap-2">
          {chatStatus.status !== "idle" && (
            <div
              className="flex items-center gap-2 text-[12px] mono"
              style={{
                color:
                  chatStatus.status === "error"
                    ? "#ef4444"
                    : chatStatus.status === "running"
                      ? "var(--role-user)"
                      : "var(--role-assistant)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    chatStatus.status === "error"
                      ? "#ef4444"
                      : chatStatus.status === "running"
                        ? "var(--role-user)"
                        : "var(--role-assistant)",
                  animation: chatStatus.status === "running" ? "pulse 1.4s ease-in-out infinite" : "none",
                }}
              />
              <span className="truncate">
                {chatStatus.message || chatStatus.trace || "处理中..."}
              </span>
            </div>
          )}

          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all"
            style={{
              borderColor: "var(--chip-border)",
              background: "var(--chip-bg)",
            }}
          >
            <span
              className="mono text-[11px] font-semibold tracking-wider"
              style={{ color: mode === "plan" ? "var(--role-tool)" : "var(--role-user)" }}
            >
              [{mode.toUpperCase()}]
            </span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatStatus.status === "running"}
              placeholder={
                chatStatus.status === "running"
                  ? "Harness 正在执行任务中..."
                  : "输入指令或任务，回车直接调用 Harness CLI..."
              }
              className="h-8 flex-1 bg-transparent text-[13px] outline-none disabled:opacity-50"
              style={{ color: "var(--text-primary)" }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || chatStatus.status === "running"}
              className="flex h-7 items-center justify-center rounded-lg px-3 text-[12px] font-medium transition-opacity disabled:opacity-30"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg)",
              }}
            >
              发送
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
