import type { ContextMessage } from '@agent-core/context/context-types';

export interface HistorySummary {
  summary: string;
  sourceCount: number;
}

const truncate = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 1)}...`;
};

export const summarizeHistory = (
  messages: ContextMessage[],
  options: { maxItems?: number; maxItemChars?: number } = {},
): HistorySummary | null => {
  if (messages.length === 0) {
    return null;
  }

  const maxItems = options.maxItems ?? 8;
  const maxItemChars = options.maxItemChars ?? 120;
  const slice = messages.slice(-maxItems);
  const lines = slice.map((message, index) => {
    const normalized = message.content.replace(/\s+/g, ' ').trim();
    return `${index + 1}. [${message.role}] ${truncate(normalized, maxItemChars)}`;
  });

  return {
    summary: `历史摘要:\n${lines.join('\n')}`,
    sourceCount: messages.length,
  };
};
