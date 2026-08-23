import type { WebSession } from '../types';
import { entryRole, formatTime, getSessionTitle } from '../utils';

interface SidebarProps {
  sessions: WebSession[];
  activeId: string | null;
  query: string;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onDeleteSession: (id: string) => void;
  onNewTopic: () => void;
}

export function Sidebar({
  sessions,
  activeId,
  query,
  onSelect,
  onQueryChange,
  onDeleteSession,
  onNewTopic,
}: SidebarProps) {
  return (
    <aside className="sidebar-panel max-h-[50vh] lg:max-h-none">
      <header
        className="border-b px-3 py-3"
        style={{ borderColor: 'rgb(var(--panel-border))' }}
      >
        <button
          type="button"
          onClick={onNewTopic}
          className="sidebar-new-topic flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-[12px] font-medium transition-colors"
          style={{
            borderColor: 'var(--chip-border)',
            background: 'var(--chip-bg)',
            color: 'var(--text-secondary)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          开启新话题
        </button>
        <div
          className="search-box mt-2.5 flex h-8 min-w-0 items-center gap-2 rounded-lg border px-2.5"
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
              <div
                key={session.id}
                className="group relative flex items-center rounded-xl transition-all duration-200"
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
                    e.currentTarget.style.background =
                      'rgb(var(--sidebar-hover))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '';
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  aria-current={active ? 'true' : undefined}
                  className="flex min-w-0 flex-1 items-start gap-2.5 px-2.5 py-2 text-left"
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
                      className="truncate text-[13px] font-medium leading-snug"
                      style={{
                        color: active
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {getSessionTitle(session)}
                    </div>
                    <div
                      className="mt-1 flex items-center gap-1.5 text-[11px]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <span>{session.entries.length} 条</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span className="truncate">
                        {formatTime(session.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  title="删除会话"
                  aria-label={`删除会话 ${getSessionTitle(session)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
