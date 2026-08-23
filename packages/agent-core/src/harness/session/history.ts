import type { ContextMessage } from '../context/context-types';
import type { EntryLike, SessionStoreLike } from './store-types';
import { getSharedSessionStore } from './store-registry';

const entryToContextMessage = (entry: EntryLike): ContextMessage | null => {
  const payload = entry.payload as { content?: unknown; role?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }

  // user 消息由 context-builder 单独放入，避免重复；tool 结果沿用 runLoop 的 user 角色。
  if (entry.type === 'assistant') {
    return { role: 'assistant', content: payload.content };
  }
  if (entry.type === 'tool') {
    return { role: 'user', content: payload.content };
  }
  if (entry.type === 'compaction' || entry.type === 'branch_summary') {
    const summary = (payload as { summary?: unknown }).summary;
    if (typeof summary !== 'string') {
      return null;
    }
    const prefix = entry.type === 'compaction' ? '[历史摘要]' : '[分支摘要]';
    return { role: 'user', content: `${prefix}\n${summary}` };
  }
  return null;
};

const isContextMessage = (value: unknown): value is ContextMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as { role?: unknown; content?: unknown };
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
};

/**
 * 读取任务会话历史，供 runLoop 恢复上下文使用。
 * 只返回 assistant/tool 条目，user 指令由 buildRuntimeContext 单独拼接。
 */
export const readTaskHistory = (
  task: { id: string },
  options: { limit?: number } = {},
  store: SessionStoreLike = getSharedSessionStore(),
): ContextMessage[] => {
  // getEntries 按 seq 升序返回，这里取最近 limit 条，避免只拿到最早的历史。
  const limit = options.limit ?? 1000;
  const entries = store.getEntries(task.id, { limit: Math.max(limit, 1000) });

  let lastCompactionIndex = -1;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (entries[index].type === 'compaction') {
      lastCompactionIndex = index;
      break;
    }
  }

  if (lastCompactionIndex >= 0) {
    const compaction = entries[lastCompactionIndex];
    const payload = compaction.payload as { retainedTail?: unknown } | null;
    const retainedTail = Array.isArray(payload?.retainedTail)
      ? payload.retainedTail.filter(isContextMessage)
      : [];
    const history: ContextMessage[] = [
      ...(entryToContextMessage(compaction) ? [entryToContextMessage(compaction)!] : []),
      ...retainedTail,
      ...entries
        .slice(lastCompactionIndex + 1)
        .map(entryToContextMessage)
        .filter((item): item is ContextMessage => item !== null),
    ];
    return history.slice(-limit);
  }

  return entries
    .slice(-limit)
    .map(entryToContextMessage)
    .filter((item): item is ContextMessage => item !== null);
};

export { entryToContextMessage };
