import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  LongMemoryItem,
  MemorySnapshot,
  ShortMemoryItem,
} from '@agent-core/memory/memory-schema';

export interface MemoryStoreConfig {
  shortLimit: number;
  memoryFile: string;
}

const DEFAULT_CONFIG: MemoryStoreConfig = {
  shortLimit: 40,
  memoryFile:
    process.env.AGENT_MEMORY_FILE ??
    path.resolve(process.cwd(), '.agent-memory', 'memory.json'),
};

export class MemoryStore {
  private readonly shortMemory: ShortMemoryItem[] = [];
  private readonly longMemory: LongMemoryItem[] = [];
  private readonly config: MemoryStoreConfig;
  private lastError: string | null = null;

  constructor(config: Partial<MemoryStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.load();
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
    const overflow = this.shortMemory.length - this.config.shortLimit;
    if (overflow > 0) {
      this.shortMemory.splice(0, overflow);
    }

    this.persist();
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
      this.persist();
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
    this.persist();
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
      this.persist();
      return;
    }

    const kept = this.shortMemory.filter((item) => item.taskId !== taskId);
    this.shortMemory.splice(0, this.shortMemory.length, ...kept);
    this.persist();
  }

  snapshot(): MemorySnapshot {
    return {
      short: this.listShort(),
      long: this.listLong(),
    };
  }

  getMemoryFile(): string {
    return this.config.memoryFile;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private load() {
    try {
      this.ensureStorageFile();
      const raw = fs.readFileSync(this.config.memoryFile, 'utf8').trim();
      if (!raw) {
        this.persist();
        return;
      }

      const parsed = JSON.parse(raw) as Partial<MemorySnapshot>;
      const short = Array.isArray(parsed.short) ? parsed.short : [];
      const long = Array.isArray(parsed.long) ? parsed.long : [];

      this.shortMemory.splice(
        0,
        this.shortMemory.length,
        ...short.filter(isShortMemoryItem).slice(-this.config.shortLimit),
      );
      this.longMemory.splice(
        0,
        this.longMemory.length,
        ...long.filter(isLongMemoryItem),
      );
      this.lastError = null;
    } catch (error) {
      this.shortMemory.splice(0, this.shortMemory.length);
      this.longMemory.splice(0, this.longMemory.length);
      this.lastError = `Failed to load memory file ${this.config.memoryFile}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private persist() {
    try {
      fs.mkdirSync(path.dirname(this.config.memoryFile), { recursive: true });
      fs.writeFileSync(
        this.config.memoryFile,
        `${JSON.stringify(this.snapshot(), null, 2)}\n`,
        'utf8',
      );
      this.lastError = null;
    } catch (error) {
      this.lastError = `Failed to persist memory file ${this.config.memoryFile}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private ensureStorageFile() {
    fs.mkdirSync(path.dirname(this.config.memoryFile), { recursive: true });
    if (!fs.existsSync(this.config.memoryFile)) {
      fs.writeFileSync(
        this.config.memoryFile,
        `${JSON.stringify({ short: [], long: [] }, null, 2)}\n`,
        'utf8',
      );
    }
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isMemoryBase = (
  value: Partial<ShortMemoryItem | LongMemoryItem>,
): value is ShortMemoryItem | LongMemoryItem =>
  typeof value.id === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string' &&
  (typeof value.taskId === 'string' || typeof value.taskId === 'undefined');

const isShortMemoryItem = (value: unknown): value is ShortMemoryItem => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<ShortMemoryItem>;
  return (
    isMemoryBase(item) &&
    item.kind === 'short' &&
    ['user', 'assistant', 'system', 'tool'].includes(item.role ?? '') &&
    typeof item.content === 'string' &&
    isStringArray(item.tags)
  );
};

const isLongMemoryItem = (value: unknown): value is LongMemoryItem => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<LongMemoryItem>;
  return (
    isMemoryBase(item) &&
    item.kind === 'long' &&
    typeof item.topic === 'string' &&
    typeof item.content === 'string' &&
    ['confirmed', 'stable'].includes(item.confidence ?? '') &&
    typeof item.sourceCount === 'number'
  );
};

export const memoryStore = new MemoryStore();
