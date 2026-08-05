import { memoryStore } from '@agent-core/memory/memory-store';

export interface RetrievedMemory {
  longFacts: string[];
}

const hasAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

export const retrieveMemoryForTask = (taskInput: string): RetrievedMemory => {
  const lowerInput = taskInput.toLowerCase();
  const keywords = lowerInput
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

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

  return { longFacts };
};
