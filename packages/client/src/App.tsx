import { useEffect, useMemo, useState } from 'react';
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
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
      const requestedId = new URLSearchParams(window.location.search).get('session');
      setActiveId(
        requestedId && result?.sessions.some((session) => session.id === requestedId)
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
      <div className="grid min-h-screen place-items-center bg-[#eef3f7] text-slate-500 dark:bg-[#05070a] dark:text-slate-400">
        正在读取会话
      </div>
    );
  }

  if (loadState === 'error' || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef3f7] text-slate-500 dark:bg-[#05070a] dark:text-slate-400">
        无法读取会话数据
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f7] p-4 text-slate-800 dark:bg-[#05070a] dark:text-slate-100">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <Sidebar
          sessions={filteredSessions}
          activeId={activeId}
          query={query}
          theme={theme}
          onSelect={setActiveId}
          onQueryChange={setQuery}
          onThemeChange={setTheme}
        />
        <MainPanel session={activeSession} filter={filter} onFilterChange={setFilter} />
      </div>
    </div>
  );
}
