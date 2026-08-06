import { useMemo } from 'react';
import type { Theme, WebSession } from '../types';
import { entryRole, formatTime, getSessionMode, getSessionTitle } from '../utils';

interface SidebarProps {
  sessions: WebSession[];
  activeId: string | null;
  query: string;
  theme: Theme;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onThemeChange: (theme: Theme) => void;
}

const glassPanel =
  'flex max-h-[46vh] min-h-0 flex-col overflow-hidden rounded-lg border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:max-h-none dark:border-white/10 dark:bg-[#0d1116]/75 dark:shadow-[0_18px_60px_rgba(0,0,0,0.42)]';

export function Sidebar({
  sessions,
  activeId,
  query,
  theme,
  onSelect,
  onQueryChange,
  onThemeChange,
}: SidebarProps) {
  const stats = useMemo(() => {
    const messages = sessions.reduce((sum, session) => sum + session.entries.length, 0);
    const tools = sessions.reduce(
      (sum, session) =>
        sum + session.entries.filter((entry) => entryRole(entry) === 'tool').length,
      0,
    );
    return { sessions: sessions.length, messages, tools };
  }, [sessions]);

  const statDefs = [
    ['会话', stats.sessions],
    ['消息', stats.messages],
    ['工具', stats.tools],
  ] as const;

  return (
    <aside className={glassPanel}>
      <div className="border-b border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 font-extrabold text-teal-950 dark:bg-cyan-400 dark:text-cyan-950">
              CC
            </span>
            <span className="text-slate-700 dark:text-slate-200">Call Code</span>
          </div>

          <div className="flex rounded-lg border border-black/10 bg-white/40 p-0.5 dark:border-white/10 dark:bg-white/5">
            {(['light', 'dark'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onThemeChange(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  theme === value
                    ? 'bg-white text-slate-900 shadow dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {value === 'light' ? '毛玻璃' : '高级黑'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3.5 flex h-9 items-center gap-2 rounded-lg border border-black/10 bg-white/40 px-2.5 dark:border-white/10 dark:bg-white/5">
          <span className="text-slate-400 dark:text-slate-500">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="h-full w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {statDefs.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-black/10 bg-white/40 p-2 dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                {value}
              </div>
              <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-slate-400 dark:text-slate-500">
            暂无会话
          </div>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                className={`mb-1.5 block w-full rounded-lg border p-3 text-left transition ${
                  active
                    ? 'border-black/15 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-slate-800/80'
                    : 'border-transparent hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <div className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {getSessionTitle(session)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <span>
                    {getSessionMode(session).toUpperCase()} · {session.entries.length} 条
                  </span>
                  <span>{formatTime(session.createdAt)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
