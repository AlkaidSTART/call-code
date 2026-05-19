import type { TaskState } from '@core/state';
import { summarizeHistory } from '@agent-core/context/context-summarizer';
import type { ContextMessage } from '@agent-core/context/context-types';
import { memoryStore } from '@agent-core/memory/memory-store';

const countStableMentions = (messages: ContextMessage[], text: string): number =>
  messages.reduce((count, item) => {
    if (item.content.includes(text)) {
      return count + 1;
    }
    return count;
  }, 0);

export const writeShortMemory = (
  task: TaskState,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  tags: string[] = [],
) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  memoryStore.addShort({
    role,
    content: trimmed,
    tags,
    taskId: task.id,
  });
};

export const archiveShortMemory = (task: TaskState): string | null => {
  const items = memoryStore.listShort(task.id);
  const summary = summarizeHistory(
    items.map((item) => ({
      role: item.role === 'tool' ? 'assistant' : item.role,
      content: item.content,
    })),
    { maxItems: 10, maxItemChars: 120 },
  )?.summary;

  memoryStore.clearShort(task.id);
  return summary ?? null;
};

export const promoteStableFact = (
  task: TaskState,
  topic: string,
  fact: string,
  sourceMessages: ContextMessage[],
) => {
  const trimmedFact = fact.trim();
  if (!trimmedFact) {
    return;
  }

  const mentions = countStableMentions(sourceMessages, trimmedFact);
  if (mentions < 2) {
    return;
  }

  memoryStore.upsertLong({
    topic: topic.trim() || 'general',
    content: trimmedFact,
    confidence: 'stable',
    sourceCount: mentions,
    taskId: task.id,
  });
};
