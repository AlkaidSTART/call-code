import {
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  persistCompactionEntry,
  prepareMessagesToCompact,
  type CompactResult,
  type SummarizeFn,
} from '../harness/compaction/compaction.js';
import { readTaskHistory } from '../harness/session/history.js';
import type { SessionStoreLike } from '../harness/session/store-types.js';

export interface CompactStoredSessionOptions {
  summarize: SummarizeFn;
}

/**
 * 手动压缩已持久化会话：强制保留最近一条消息，其余历史生成摘要并写回存储。
 * 返回 null 表示没有可压缩的历史。
 */
export const compactStoredSession = async (
  sessionId: string,
  store: SessionStoreLike,
  options: CompactStoredSessionOptions,
): Promise<CompactResult | null> => {
  const history = readTaskHistory({ id: sessionId }, { limit: 100 }, store);
  const settings = { ...DEFAULT_COMPACTION_SETTINGS, keepRecentTokens: 0 };
  const preparation = prepareMessagesToCompact(history, settings);
  if (!preparation) {
    return null;
  }

  const result = await compact(preparation, { summarize: options.summarize });
  if (!result) {
    return null;
  }

  persistCompactionEntry(sessionId, result, store);
  return result;
};
