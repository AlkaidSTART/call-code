import { useEffect, useMemo, useState } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { loadWebExport } from './data';
import type { Filter, Theme, WebExport } from './types';
import { filterSessions } from './utils';

const THEME_KEY = 'call-code-theme';

const initialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
};

export default function App() {
  const [data, setData] = useState<WebExport | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;

    loadWebExport().then((result) => {
      if (cancelled) {
        return;
      }

      setData(result);
      const requestedId = new URLSearchParams(window.location.search).get(
        'session',
      );
      setActiveId(
        requestedId &&
          result?.sessions.some((session) => session.id === requestedId)
          ? requestedId
          : (result?.sessions[0]?.id ?? null),
      );
      setLoadState(result ? 'ready' : 'error');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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

  if (loadState === 'loading') {
    return (
      <div className="app-shell">
        <div
          className="grid min-h-[60vh] place-items-center text-sm"
          style={{ color: 'var(--text-tertiary)' }}
        >
          正在读取会话
        </div>
      </div>
    );
  }

  if (loadState === 'error' || !data) {
    return (
      <div className="app-shell">
        <div
          className="grid min-h-[60vh] place-items-center text-sm"
          style={{ color: 'var(--text-tertiary)' }}
        >
          无法读取会话数据
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <HeaderBar
          sessions={filteredSessions}
          theme={theme}
          onThemeChange={setTheme}
        />
        <div className="app-workspace">
          <Sidebar
            sessions={filteredSessions}
            activeId={activeId}
            query={query}
            onSelect={setActiveId}
            onQueryChange={setQuery}
          />
          <MainPanel
            session={activeSession}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </div>
    </div>
  );
}
