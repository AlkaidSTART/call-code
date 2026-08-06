export type Theme = 'light' | 'dark';

export type EntryRole = 'user' | 'assistant' | 'tool' | 'system';

export type Filter = 'all' | EntryRole;

export interface WebEntry {
  seq: number;
  id: string;
  parentId: string | null;
  type: string;
  role: string;
  timestamp: string;
  text?: string;
  tool?: string | null;
  tags?: string[];
  payload: unknown;
}

export interface WebRecord {
  seq: number;
  id: string;
  lane: string;
  runId: string | null;
  type: string;
  opKind: string | null;
  timestamp: string;
  payload: unknown;
}

export interface WebFact {
  seq: number;
  kind: string;
  key: string | null;
  value: string | null;
}

export interface WebStats {
  messageCount: number;
  cachedTokens: number;
  uncachedTokens: number;
  totalTokens: number;
  costTotal: number;
}

export interface WebSession {
  id: string;
  createdAt: string;
  cwd: string;
  parentSessionId: string | null;
  metadata: Record<string, unknown>;
  stats: WebStats;
  entries: WebEntry[];
  records?: WebRecord[];
  facts?: WebFact[];
}

export interface WebExport {
  schemaVersion: 1;
  exportedAt: string;
  sessions: WebSession[];
}
