import { useEffect, useMemo, useState } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { connectLiveExport } from './ws';
import type { Filter, Theme, WebExport } from './types';
import { filterSessions } from './utils';
import { ParticleField } from './components/ParticleField';

const THEME_KEY = 'call-code-theme';

const initialTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'clear' || stored === 'frosted' || stored === 'apricot'
    ? stored
    : 'frosted';
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

    const connection = connectLiveExport({
      onSnapshot: (result) => {
        if (cancelled) {
          return;
        }

        setData(result);
        setLoadState('ready');
        setActiveId((current) => {
          const requestedId = new URLSearchParams(window.location.search).get(
            'session',
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
    });

    connection.ready.then((result) => {
      if (cancelled) {
        return;
      }
      setLoadState(result ? 'ready' : 'error');
    });

    return () => {
      cancelled = true;
      connection.close();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = theme === 'light' ? 'frosted' : theme === 'dark' ? 'apricot' : theme;
    root.classList.remove('dark');
    root.dataset.theme = resolvedTheme;
    localStorage.setItem(THEME_KEY, resolvedTheme);
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
