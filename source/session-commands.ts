import type { SessionStoreLike } from '@agent-core/harness/session/store-types';

const compactText = (text: string, maxLength = 96): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
};

const entryContent = (entry: { payload: unknown }): string => {
  if (!entry.payload || typeof entry.payload !== 'object') {
    return '';
  }
  const content = (entry.payload as { content?: unknown }).content;
  return typeof content === 'string' ? content : '';
};

/** 生成 /sessions 的展示文本 */
export const formatSessionList = (
  store: SessionStoreLike,
  limit = 20,
): string => {
  const sessions = store.listSessions({ limit });
  if (sessions.length === 0) {
    return '暂无会话。';
  }

  const lines = sessions.map((session) => {
    const objective = session.metadata?.objective;
    const title =
      typeof objective === 'string' && objective.trim()
        ? compactText(objective, 44)
        : session.id;
    return `${session.id}  ${store.getStats(session.id).messageCount} 条  ${title}`;
  });
  return ['会话列表:', ...lines].join('\n');
};

/** 生成 /session 的展示文本 */
export const formatSessionEntries = (
  store: SessionStoreLike,
  sessionId: string,
  limit = 100,
): string => {
  const entries = store.getEntries(sessionId, { limit });
  if (entries.length === 0) {
    return '未找到会话或会话没有消息。';
  }

  return entries
    .map(
      (entry) =>
        `${entry.seq} ${entry.type} ${entry.id}\n${compactText(entryContent(entry), 88)}`,
    )
    .join('\n\n');
};

/** 删除单条消息并返回给用户的反馈文本 */
export const deleteMessagesCommand = (
  store: SessionStoreLike,
  sessionId: string,
  entryId: string,
): string => {
  const deleted = store.deleteEntries(sessionId, [entryId]);
  return deleted > 0
    ? `已删除 ${deleted} 条消息（含后续回复）。`
    : '未找到该消息。';
};

/** 删除整个会话并返回给用户的反馈文本 */
export const deleteSessionCommand = (
  store: SessionStoreLike,
  sessionId: string,
): string =>
  store.deleteSession(sessionId) ? '已删除整个会话。' : '未找到该会话。';

/** 带参数命令的用法提示 */
export const sessionCommandUsage = (
  command: 'session' | 'delmsg' | 'delsession',
): string => {
  if (command === 'session') {
    return '用法: /session <sessionId>';
  }
  if (command === 'delmsg') {
    return '用法: /delmsg <sessionId> <entryId>';
  }
  return '用法: /delsession <sessionId>';
};
