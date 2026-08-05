import { randomUUID } from 'node:crypto';
import type {
  LongMemoryItem,
  MemorySnapshot,
  ShortMemoryItem,
} from '@agent-core/memory/memory-schema';

export interface MemoryStoreConfig {
  shortLimit: number;
}

const DEFAULT_CONFIG: MemoryStoreConfig = {
  shortLimit: 40,
};

export class MemoryStore {
  private readonly shortMemory: ShortMemoryItem[] = [];
  private readonly longMemory: LongMemoryItem[] = [];
  private readonly shortLimit: number;

  constructor(config: Partial<MemoryStoreConfig> = {}) {
    this.shortLimit = config.shortLimit ?? DEFAULT_CONFIG.shortLimit;
  }

  addShort(
    input: Omit<ShortMemoryItem, 'id' | 'createdAt' | 'updatedAt' | 'kind'>,
  ): ShortMemoryItem {
    const now = new Date().toISOString();
    const item: ShortMemoryItem = {
      id: randomUUID(),
      kind: 'short',
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.shortMemory.push(item);
    const overflow = this.shortMemory.length - this.shortLimit;
    if (overflow > 0) {
      this.shortMemory.splice(0, overflow);
    }

    return item;
  }

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

  listShort(taskId?: string): ShortMemoryItem[] {
    if (!taskId) {
      return [...this.shortMemory];
    }
    return this.shortMemory.filter((item) => item.taskId === taskId);
  }

  listLong(): LongMemoryItem[] {
    return [...this.longMemory];
  }

  clearShort(taskId?: string) {
    if (!taskId) {
      this.shortMemory.splice(0, this.shortMemory.length);
      return;
    }

    const kept = this.shortMemory.filter((item) => item.taskId !== taskId);
    this.shortMemory.splice(0, this.shortMemory.length, ...kept);
  }

  snapshot(): MemorySnapshot {
    return {
      short: this.listShort(),
      long: this.listLong(),
    };
  }
}

export const memoryStore = new MemoryStore();
