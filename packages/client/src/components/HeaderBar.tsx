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
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={logoUrl}
          alt="Call Code"
          className="h-9 w-9 shrink-0 rounded-xl border object-contain"
          style={{
            borderColor: 'rgb(var(--chip-border))',
            background: 'rgb(var(--chip-bg))',
          }}
        />
        <div className="min-w-0">
          <div className="brand-kicker">LIVE SESSION ARCHIVE</div>
          <h1
            className="truncate text-[18px] font-semibold leading-tight tracking-[0.01em]"
            style={{ color: 'var(--text-primary)' }}
          >
            Call Code
          </h1>
          <div
            className="mt-1 truncate text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {sessions.length} 个会话 · {count.messages} 条消息 · {count.tools}{' '}
            次工具
          </div>
          <div className={`connection-state connection-state--${connectionState}`}>
            <span aria-hidden="true" />
            {connectionState === 'loading'
              ? '连接会话服务'
              : connectionState === 'error'
                ? '等待会话服务'
                : '实时同步'}
          </div>
        </div>
      </div>

      <div className="segmented theme-switcher shrink-0" role="tablist" aria-label="主题切换">
        {(['clear', 'frosted', 'apricot'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-pressed={theme === value}
            onClick={() => onThemeChange(value)}
          >
            {value === 'clear' ? '透明玻璃' : value === 'frosted' ? '毛玻璃' : '杏色毛玻璃'}
          </button>
        ))}
      </div>
    </header>
  );
}
