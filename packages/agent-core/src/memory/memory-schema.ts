export interface MemoryBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  taskId?: string;
}

export interface LongMemoryItem extends MemoryBase {
  kind: 'long';
  topic: string;
  content: string;
  confidence: 'confirmed' | 'stable';
  sourceCount: number;
}

export interface MemorySnapshot {
  long: LongMemoryItem[];
}
