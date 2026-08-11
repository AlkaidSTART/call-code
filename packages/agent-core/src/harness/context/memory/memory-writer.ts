import type { TaskState } from '@core/state';
import type { ContextMessage } from '@agent-core/harness/context/context-types';
import { memoryStore } from '@agent-core/harness/context/memory/memory-store';

const countStableMentions = (messages: ContextMessage[], text: string): number =>
  messages.reduce((count, item) => {
    if (item.content.includes(text)) {
      return count + 1;
    }
    return count;
  }, 0);

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
