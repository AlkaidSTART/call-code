import { useMemo } from 'react';
import type { Theme, WebSession } from '../types';
import { entryRole, formatTime, getSessionTitle } from '../utils';
import logoUrl from '../../assets/call-code.png';

interface SidebarProps {
  sessions: WebSession[];
  activeId: string | null;
  query: string;
  theme: Theme;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onThemeChange: (theme: Theme) => void;
}

export function Sidebar({
  sessions,
  activeId,
  query,
  theme,
  onSelect,
  onQueryChange,
  onThemeChange,
}: SidebarProps) {
  const count = useMemo(
    () =>
      sessions.reduce(
        (acc, session) => {
          acc.messages += session.entries.length;
          acc.tools += session.entries.filter((e) => entryRole(e) === 'tool').length;
          return acc;
        },
        { messages: 0, tools: 0 },
      ),
    [sessions],
  );

  return (
    <aside className="glass-panel lg:sticky lg:top-4 lg:h-[calc(100vh-40px)] max-h-[50vh] lg:max-h-none">
      <header
        className="flex flex-col gap-3 border-b px-4 pt-4 pb-3"
        style={{ borderColor: 'rgb(var(--panel-border))' }}
      >
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Call Code"
            className="h-11 w-11 shrink-0 rounded-2xl border object-contain"
            style={{
              borderColor: 'rgb(var(--chip-border))',
              background: 'rgb(var(--chip-bg))',
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Call Code
            </div>
            <div className="mt-1 truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {sessions.length} 个会话 · {count.messages} 条消息 · {count.tools} 次工具
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="search-box flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5"
            style={{
              borderColor: 'rgb(var(--chip-border))',
              background: 'rgb(var(--chip-bg))',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-tertiary)' }}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索会话"
              aria-label="搜索会话"
              className="h-full w-full min-w-0 bg-transparent text-[12px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <div className="segmented shrink-0" role="tablist" aria-label="主题切换">
            {(['light', 'dark'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-pressed={theme === value}
                onClick={() => onThemeChange(value)}
              >
                {value === 'light' ? '毛玻璃' : '高级黑'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 会话列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-3">
        {sessions.length === 0 && (
          <div
            className="grid min-h-[120px] place-items-center text-[12px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            暂无会话
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                aria-current={active ? 'true' : undefined}
                className="group relative flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200"
                style={
                  active
                    ? {
                        background: 'rgb(var(--sidebar-active))',
                        boxShadow: 'var(--sidebar-active-shadow)',
                      }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgb(var(--sidebar-hover))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '';
                  }
                }}
              >
                {/* 激活指示器 */}
                <span
                  className="mt-1 h-4 w-1 shrink-0 rounded-full transition-opacity"
                  style={{
                    background: active ? 'var(--text-primary)' : 'transparent',
                    opacity: active ? 1 : 0,
                  }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="line-clamp-2 text-[13px] font-medium leading-snug"
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {getSessionTitle(session)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{session.entries.length} 条</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span className="truncate">{formatTime(session.createdAt)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
