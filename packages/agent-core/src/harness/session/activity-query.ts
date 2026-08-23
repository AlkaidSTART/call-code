import type { EntryLike, SessionStoreLike } from './store-types';
import { getSharedSessionStore } from './store-registry';

/**
 * 活动面板需要的历史条目。
 */
export interface RecentHistoryItem {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * 活动面板用于扫描相关页面的最近条目。
 */
export interface RecentFeedItem {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
}

const entryToRecentHistoryItem = (entry: EntryLike): RecentHistoryItem | null => {
  if (entry.type !== 'user' && entry.type !== 'assistant') {
    return null;
  }
  const payload = entry.payload as { content?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    role: entry.type,
    content: payload.content,
    timestamp: entry.timestamp,
  };
};

const entryToRecentFeedItem = (entry: EntryLike): RecentFeedItem | null => {
  const payload = entry.payload as { content?: unknown } | null;
  if (!payload || typeof payload.content !== 'string') {
    return null;
  }
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    role: entry.type,
    content: payload.content,
    timestamp: entry.timestamp,
  };
};

/**
 * 读取最近会话中的 user/assistant 条目，按时间倒序。
 */
export const loadRecentHistory = (
  limit = 8,
  store: SessionStoreLike = getSharedSessionStore(),
): RecentHistoryItem[] => {
  const sessions = store.listSessions({ limit: 20 });
  const result: RecentHistoryItem[] = [];

  for (const session of sessions) {
    const entries = store.getEntries(session.id, { limit: 1000 });
    for (let index = entries.length - 1; index >= 0; index--) {
      const item = entryToRecentHistoryItem(entries[index]);
      if (item) {
        result.push(item);
        if (result.length >= limit) {
          return result;
        }
      }
    }
  }

  return result;
};

/**
 * 读取最近条目，包含 tool 输出，用于扫描相关页面。
 */
export const loadRecentFeed = (
  limit = 200,
  store: SessionStoreLike = getSharedSessionStore(),
): RecentFeedItem[] => {
  const sessions = store.listSessions({ limit: 20 });
  const result: RecentFeedItem[] = [];

  for (const session of sessions) {
    const entries = store.getEntries(session.id, { limit: 1000 });
    for (let index = entries.length - 1; index >= 0; index--) {
      const item = entryToRecentFeedItem(entries[index]);
      if (item) {
        result.push(item);
        if (result.length >= limit) {
          return result;
        }
      }
    }
  }

  return result;
};
