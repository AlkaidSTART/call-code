import type { EntryRole } from '@call-code/server/client';

export type {
  AgentMode,
  EntryRole,
  WebEntry,
  WebRecord,
  WebFact,
  WebStats,
  WebSession,
  WebExport,
  ChatStatusMessage,
} from '@call-code/server/client';

export type Theme = 'light' | 'dark';

export type Filter = 'all' | EntryRole;
