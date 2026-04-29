import os from 'node:os';
import path from 'node:path';

export interface KnownLocations {
  cwd: string;
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  temp: string;
}

export const getKnownLocations = (): KnownLocations => {
  const home = os.homedir();

  return {
    cwd: process.cwd(),
    home,
    desktop: process.env.AGENT_DESKTOP_DIR || path.join(home, 'Desktop'),
    documents: path.join(home, 'Documents'),
    downloads: path.join(home, 'Downloads'),
    temp: os.tmpdir(),
  };
};

const aliasMap: Record<string, keyof KnownLocations> = {
  cwd: 'cwd',
  workspace: 'cwd',
  project: 'cwd',
  home: 'home',
  '~': 'home',
  desktop: 'desktop',
  桌面: 'desktop',
  documents: 'documents',
  文档: 'documents',
  downloads: 'downloads',
  下载: 'downloads',
  tmp: 'temp',
  temp: 'temp',
};

export const resolveUserPath = (inputPath: string): string => {
  const rawPath = inputPath.trim();
  if (!rawPath) {
    throw new Error('Invalid path');
  }

  const locations = getKnownLocations();
  const normalizedInput = rawPath.replace(/\\/g, '/');

  if (normalizedInput === '~') {
    return locations.home;
  }

  if (normalizedInput.startsWith('~/')) {
    return path.resolve(locations.home, normalizedInput.slice(2));
  }

  const colonAlias = normalizedInput.match(/^([^:/]+):(.*)$/);
  if (colonAlias) {
    const alias = colonAlias[1].toLowerCase();
    const target = aliasMap[alias];
    if (target) {
      return path.resolve(locations[target], colonAlias[2].replace(/^\/+/, ''));
    }
  }

  const [firstSegment, ...restSegments] = normalizedInput.split('/');
  const target = aliasMap[firstSegment.toLowerCase()];
  if (target) {
    return path.resolve(locations[target], ...restSegments);
  }

  if (path.isAbsolute(rawPath)) {
    return path.resolve(rawPath);
  }

  return path.resolve(locations.cwd, rawPath);
};
