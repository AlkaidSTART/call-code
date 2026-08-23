import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { Sidebar } from "./components/Sidebar";
import { MainPanel } from "./components/MainPanel";
import { connectLiveExport, type LiveExportConnection } from "./ws";
import type { AgentMode, ChatStatusMessage, Filter, Theme, WebExport } from "./types";
import { filterSessions } from "./utils";
import { ParticleField } from "./components/ParticleField";

const THEME_KEY = "call-code-theme";

const initialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
};

export default function App() {
  const [data, setData] = useState<WebExport | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [chatStatus, setChatStatus] = useState<ChatStatusMessage>({
    status: "idle",
  });
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const connectionRef = useRef<LiveExportConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    const conn = connectLiveExport({
      onSnapshot: (result) => {
        if (cancelled) {
          return;
        }

        setData(result);
        setLoadState("ready");
        setActiveId((current) => {
          const requestedId = new URLSearchParams(window.location.search).get(
            "session",
          );
          const candidates = [
            requestedId,
            current,
            result.sessions[0]?.id ?? null,
          ];
          return (
            candidates.find(
              (id) =>
                id !== null &&
                id !== undefined &&
                result.sessions.some((session) => session.id === id),
            ) ?? null
          );
        });
      },
      onChatStatus: (statusMsg) => {
        if (cancelled) {
          return;
        }
        setChatStatus(statusMsg);
      },
    });

    connectionRef.current = conn;

    conn.ready.then((result) => {
      if (cancelled) {
        return;
      }
      setLoadState(result ? "ready" : "error");
    });

    return () => {
      cancelled = true;
      conn.close();
      connectionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleSendMessage = (payload: { input: string; mode: AgentMode }) => {
    if (!connectionRef.current) {
      return false;
    }
    return connectionRef.current.sendMessage(payload);
  };

  const handleDeleteEntry = (sessionId: string, entryId: string) => {
    if (!window.confirm("删除这条消息及其后续回复？")) {
      return;
    }
    connectionRef.current?.deleteMessages(sessionId, [entryId]);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!window.confirm("删除整个会话？此操作无法撤销。")) {
      return;
    }
    connectionRef.current?.deleteMessages(sessionId);
  };

  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const filteredSessions = useMemo(
    () => filterSessions(sessions, query),
    [sessions, query],
  );
  const activeSession = useMemo(
    () =>
      filteredSessions.find((session) => session.id === activeId) ??
      filteredSessions[0] ??
      null,
    [filteredSessions, activeId],
  );

  return (
    <div className="app-shell">
      <ParticleField />
      <div className="app-frame">
        <HeaderBar
          sessions={filteredSessions}
          theme={theme}
          onThemeChange={setTheme}
          connectionState={loadState}
        />
        <div className="app-workspace">
          <Sidebar
            sessions={filteredSessions}
            activeId={activeId}
            query={query}
            onSelect={setActiveId}
            onQueryChange={setQuery}
            onDeleteSession={handleDeleteSession}
          />
          <MainPanel
            session={activeSession}
            filter={filter}
            onFilterChange={setFilter}
            chatStatus={chatStatus}
            onSendMessage={handleSendMessage}
            onDeleteEntry={handleDeleteEntry}
          />
        </div>
      </div>
    </div>
  );
}
