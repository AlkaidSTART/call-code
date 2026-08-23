import type { Theme, WebSession } from '../types';
import { entryRole } from '../utils';
import logoUrl from '../../assets/call-code.png';

interface HeaderBarProps {
  sessions: WebSession[];
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  connectionState?: 'loading' | 'ready' | 'error';
}

export function HeaderBar({
  sessions,
  theme,
  onThemeChange,
  connectionState = 'ready',
}: HeaderBarProps) {
  const count = sessions.reduce(
    (acc, session) => {
      acc.messages += session.entries.length;
      acc.tools += session.entries.filter(
        (entry) => entryRole(entry) === 'tool',
      ).length;
      return acc;
    },
    { messages: 0, tools: 0 },
  );

  return (
    <header className="header-bar">
      <div className="flex min-w-0 items-center gap-2.5">
        <img
          src={logoUrl}
          alt="Call Code"
          className="h-8 w-8 shrink-0 rounded-lg border object-contain"
          style={{
            borderColor: 'var(--chip-border)',
            background: 'var(--chip-bg)',
          }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1
              className="truncate text-[15px] font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Call Code
            </h1>
            <div className={`connection-state connection-state--${connectionState}`}>
              <span aria-hidden="true" />
              {connectionState === 'loading'
                ? '连接中'
                : connectionState === 'error'
                  ? '等待会话服务'
                  : '实时'}
            </div>
          </div>
          <div
            className="truncate text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {sessions.length} 个会话 · {count.messages} 条消息 · {count.tools} 次工具
          </div>
        </div>
      </div>

      <div className="segmented theme-switcher shrink-0" role="tablist" aria-label="主题切换">
        {(['light', 'dark'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-pressed={theme === value}
            onClick={() => onThemeChange(value)}
          >
            {value === 'light' ? '浅色' : '深色'}
          </button>
        ))}
      </div>
    </header>
  );
}
