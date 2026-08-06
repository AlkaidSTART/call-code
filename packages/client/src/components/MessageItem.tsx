import type { WebEntry } from '../types';
import { entryRole, entryText, formatTime } from '../utils';

interface MessageItemProps {
  entry: WebEntry;
}

const roleMeta = {
  user: { avatar: 'U', label: '用户', className: 'bg-teal-600 text-white dark:bg-cyan-400 dark:text-cyan-950' },
  assistant: { avatar: 'A', label: '助手', className: 'bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-950' },
  tool: { avatar: 'T', label: '工具', className: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  system: { avatar: 'S', label: '系统', className: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
} as const;

export function MessageItem({ entry }: MessageItemProps) {
  const role = entryRole(entry);
  const meta = roleMeta[role];
  const text = entryText(entry);
  const isCode = role === 'tool' || text.length > 320;

  return (
    <article className="grid grid-cols-[34px_minmax(0,1fr)] gap-2.5">
      <div
        className={`grid h-[34px] w-[34px] place-items-center rounded-lg border border-black/10 text-xs font-extrabold dark:border-white/10 ${meta.className}`}
      >
        {meta.avatar}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{meta.label}</span>
            {entry.tool ? (
              <span className="rounded-lg border border-black/10 bg-white/40 px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {entry.tool}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {formatTime(entry.timestamp)}
          </div>
        </div>

        {isCode ? (
          <pre className="m-0 overflow-auto rounded-lg border border-black/10 bg-black/5 p-3 text-[13px] leading-relaxed text-slate-700 dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
            {text}
          </pre>
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {text}
          </div>
        )}
      </div>
    </article>
  );
}
