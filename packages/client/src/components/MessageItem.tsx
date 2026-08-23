import type { WebEntry } from '../types';
import { entryRole, entryText, formatTime } from '../utils';
import type { EntryRole } from '../types';

interface MessageItemProps {
  entry: WebEntry;
  onDelete?: () => void;
}

const roleMeta: Record<EntryRole, { label: string; dotClass: string; bubbleClass: string }> = {
  user: { label: '用户', dotClass: 'role-dot role-dot--user', bubbleClass: 'msg-bubble--user' },
  assistant: { label: '助手', dotClass: 'role-dot role-dot--assistant', bubbleClass: 'msg-bubble--assistant' },
  tool: { label: '工具', dotClass: 'role-dot role-dot--tool', bubbleClass: 'msg-bubble--tool' },
  system: { label: '系统', dotClass: 'role-dot role-dot--system', bubbleClass: '' },
};

export function MessageItem({ entry, onDelete }: MessageItemProps) {
  const role = entryRole(entry);
  const meta = roleMeta[role];
  const text = entryText(entry);
  const isCode = role === 'tool' || text.length > 320;

  return (
    <article className="group relative flex gap-3">
      {/* 角色指示点 */}
      <div className="pt-1.5">
        <span className={meta.dotClass} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        {/* 元信息行 */}
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          <span style={{ color: `var(--role-${role})` }}>{meta.label}</span>
          {entry.tool ? (
            <span className="chip !py-0 !text-[10px]">{entry.tool}</span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span>{formatTime(entry.timestamp)}</span>
            {onDelete ? (
              <button
                type="button"
                aria-label="删除消息"
                title="删除消息"
                onClick={onDelete}
                className="flex h-6 w-6 items-center justify-center rounded-md opacity-40 transition-opacity hover:opacity-100"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <svg
                  width="12"
                  height="12"
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
            ) : null}
          </span>
        </div>

        {/* 内容 */}
        {isCode ? (
          <pre
            className={`msg-bubble ${meta.bubbleClass} mono m-0 max-h-[480px] overflow-auto px-3.5 py-2.5 text-[12px]`}
            style={{ color: 'var(--text-secondary)' }}
          >
            {text}
          </pre>
        ) : (
          <div
            className={`msg-bubble ${meta.bubbleClass} whitespace-pre-wrap break-words px-3.5 py-2.5 text-[13.5px] leading-relaxed`}
            style={{ color: 'var(--text-primary)' }}
          >
            {text}
          </div>
        )}
      </div>
    </article>
  );
}
