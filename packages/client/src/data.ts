import type { WebExport, WebSession } from './types';

const DEFAULT_DATA_URLS = ['./data.json', './data.example.json'];

const resolveDataUrls = (): string[] => {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('data') || params.get('dataUrl');
  return override ? [override, ...DEFAULT_DATA_URLS] : DEFAULT_DATA_URLS;
};

const isWebSession = (value: unknown): value is WebSession => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<WebSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.cwd === 'string' &&
    Array.isArray(session.entries)
  );
};

const isWebExport = (value: unknown): value is WebExport => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Partial<WebExport>;
  return (
    data.schemaVersion === 1 &&
    typeof data.exportedAt === 'string' &&
    Array.isArray(data.sessions) &&
    data.sessions.every(isWebSession)
  );
};

export const loadWebExport = async (): Promise<WebExport | null> => {
  for (const url of resolveDataUrls()) {
    try {
      const target = new URL(url, window.location.href);
      const response = await fetch(target, { cache: 'no-cache' });
      if (!response.ok) {
        continue;
      }

      const value: unknown = await response.json();
      if (isWebExport(value)) {
        return value;
      }
    } catch {
      // 继续尝试下一个数据源
    }
  }

  return null;
};
