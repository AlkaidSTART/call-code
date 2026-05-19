import { summarizeHistory } from '@agent-core/context/context-summarizer';
import type { ContextMessage } from '@agent-core/context/context-types';
import { memoryStore } from '@agent-core/memory/memory-store';

export interface RetrievedMemory {
  shortSummary?: string;
  longFacts: string[];
}

const hasAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

export const retrieveMemoryForTask = (
  taskInput: string,
  taskId: string,
): RetrievedMemory => {
  const lowerInput = taskInput.toLowerCase();
  const keywords = lowerInput
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const shortItems = memoryStore.listShort(taskId);
  const shortMessages: ContextMessage[] = shortItems.map((item) => ({
    role: item.role === 'tool' ? 'assistant' : item.role,
    content: item.content,
  }));
  const shortSummary = summarizeHistory(shortMessages, {
    maxItems: 6,
    maxItemChars: 100,
  })?.summary;

  const longFacts = memoryStore
    .listLong()
    .filter((item) => {
      if (keywords.length === 0) {
        return true;
      }
      const haystack = `${item.topic} ${item.content}`.toLowerCase();
      return hasAny(haystack, keywords);
    })
    .slice(-8)
    .map((item) => `${item.topic}: ${item.content}`);

  return { shortSummary, longFacts };
};
