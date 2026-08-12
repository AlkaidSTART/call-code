import { randomUUID } from 'node:crypto';
import type {
  LongMemoryItem,
  MemorySnapshot,
} from '@agent-core/harness/session/memory/memory-schema';

export class MemoryStore {
  private readonly longMemory: LongMemoryItem[] = [];

  upsertLong(
    input: Omit<LongMemoryItem, 'id' | 'createdAt' | 'updatedAt' | 'kind'>,
  ): LongMemoryItem {
    const now = new Date().toISOString();
    const found = this.longMemory.find(
      (item) => item.topic === input.topic && item.content === input.content,
    );

    if (found) {
      found.updatedAt = now;
      found.sourceCount = Math.max(found.sourceCount, input.sourceCount);
      found.confidence = found.confidence === 'confirmed' ? found.confidence : input.confidence;
      return found;
    }

    const item: LongMemoryItem = {
      id: randomUUID(),
      kind: 'long',
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.longMemory.push(item);
    return item;
  }

  listLong(): LongMemoryItem[] {
    return [...this.longMemory];
  }

  snapshot(): MemorySnapshot {
    return {
      long: this.listLong(),
    };
  }
}

export const memoryStore = new MemoryStore();
