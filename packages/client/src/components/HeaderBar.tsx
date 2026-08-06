import type { Theme, WebSession } from '../types';
import { entryRole } from '../utils';
import logoUrl from '../../assets/call-code.png';

interface HeaderBarProps {
  sessions: WebSession[];
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function HeaderBar({ sessions, theme, onThemeChange }: HeaderBarProps) {
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
          <h1
            className="truncate text-[17px] font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Call Code
          </h1>
          <div
            className="mt-0.5 truncate text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {sessions.length} 个会话 · {count.messages} 条消息 · {count.tools}{' '}
            次工具
          </div>
        </div>
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
    </header>
  );
}
