export type MemoryKind = 'short' | 'long';

export interface MemoryBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  taskId?: string;
}

export interface ShortMemoryItem extends MemoryBase {
  kind: 'short';
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tags: string[];
}

export interface LongMemoryItem extends MemoryBase {
  kind: 'long';
  topic: string;
  content: string;
  confidence: 'confirmed' | 'stable';
  sourceCount: number;
}

export type MemoryItem = ShortMemoryItem | LongMemoryItem;

export interface MemorySnapshot {
  short: ShortMemoryItem[];
  long: LongMemoryItem[];
}
