import type { WebEntry } from '../types';
import { entryRole, entryText, formatTime } from '../utils';
import type { EntryRole } from '../types';

interface MessageItemProps {
  entry: WebEntry;
}

const roleMeta: Record<EntryRole, { label: string; dotClass: string; bubbleClass: string }> = {
  user: { label: '用户', dotClass: 'role-dot role-dot--user', bubbleClass: 'msg-bubble--user' },
  assistant: { label: '助手', dotClass: 'role-dot role-dot--assistant', bubbleClass: 'msg-bubble--assistant' },
  tool: { label: '工具', dotClass: 'role-dot role-dot--tool', bubbleClass: 'msg-bubble--tool' },
  system: { label: '系统', dotClass: 'role-dot role-dot--system', bubbleClass: '' },
};

export function MessageItem({ entry }: MessageItemProps) {
  const role = entryRole(entry);
  const meta = roleMeta[role];
  const text = entryText(entry);
  const isCode = role === 'tool' || text.length > 320;

  return (
    <article className="flex gap-3">
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
          <span className="ml-auto shrink-0">{formatTime(entry.timestamp)}</span>
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
