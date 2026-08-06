import type { EntryRole, Filter, WebEntry, WebSession } from './types';

export const entryRole = (entry: WebEntry): EntryRole => {
  const role = entry.role || entry.type;
  if (role === 'user' || role === 'assistant' || role === 'tool' || role === 'system') {
    return role;
  }
  return 'assistant';
};

export const entryText = (entry: WebEntry): string => {
  if (entry.text) {
    return entry.text;
  }

  if (entry.payload && typeof entry.payload === 'object' && 'content' in entry.payload) {
    const content = (entry.payload as { content?: unknown }).content;
    if (typeof content === 'string') {
      return content;
    }
  }

  return '';
};

export const getSessionTitle = (session: WebSession): string => {
  const firstUser = session.entries.find((entry) => entryRole(entry) === 'user');
  if (firstUser) {
    const text = entryText(firstUser).trim();
    if (text) {
      return text;
    }
  }

  const objective = session.metadata?.objective;
  if (typeof objective === 'string' && objective.trim()) {
    return objective;
  }

  return session.id;
};

export const getSessionMode = (session: WebSession): string => {
  const mode = session.metadata?.mode;
  return typeof mode === 'string' ? mode : 'build';
};

export const formatTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const matchesQuery = (session: WebSession, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [session.id, session.cwd, getSessionTitle(session)].map((value) =>
    value.toLowerCase(),
  );

  for (const entry of session.entries) {
    haystack.push(entryText(entry).toLowerCase());
    if (entry.tool) {
      haystack.push(entry.tool.toLowerCase());
    }
  }

  return haystack.some((value) => value.includes(normalized));
};

export const filterSessions = (sessions: WebSession[], query: string): WebSession[] =>
  sessions.filter((session) => matchesQuery(session, query));

export const filterEntries = (entries: WebEntry[], filter: Filter): WebEntry[] => {
  if (filter === 'all') {
    return entries;
  }
  return entries.filter((entry) => entryRole(entry) === filter);
};
