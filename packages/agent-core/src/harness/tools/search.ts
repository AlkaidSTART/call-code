import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveUserPath } from './pathUtils.js';

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_RESULTS = 100;
const MAX_RESULTS = 1000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const IGNORED_DIRECTORIES = new Set(['node_modules']);

interface NormalizedSearch {
  query: string;
  glob?: string;
  caseSensitive?: boolean;
  fixedStrings?: boolean;
  maxResults: number;
  resolvedPath: string;
}

export const searchTool = {
  name: 'search',
  description: 'Search file contents with ripgrep or a built-in Node fallback',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text or regular expression to search for',
      },
      path: {
        type: 'string',
        description:
          'Optional file or directory to search. Supports aliases like desktop:/, ~/ and temp:/.',
      },
      glob: {
        type: 'string',
        description: 'Optional ripgrep glob used to include or exclude files',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether matching should be case-sensitive',
      },
      fixedStrings: {
        type: 'boolean',
        description: 'Whether to treat the query as literal text instead of a regular expression',
      },
      maxResults: {
        type: 'number',
        description: `Maximum number of matching lines to return, up to ${MAX_RESULTS}`,
      },
    },
    required: ['query'],
  },
  run: async (input: unknown) => {
    const normalized = normalizeSearchInput(input);
    try {
      return await runRipgrepSearch(normalized);
    } catch (error) {
      if (isCommandMissing(error)) {
        return runNodeSearch(normalized);
      }
      throw error;
    }
  },
};

const normalizeSearchInput = (input: unknown): NormalizedSearch => {
  const value = input as {
    query?: unknown;
    path?: unknown;
    glob?: unknown;
    caseSensitive?: unknown;
    fixedStrings?: unknown;
    maxResults?: unknown;
  };
  const query = validateRequiredString(value.query, 'query');
  const searchPath = validateOptionalString(value.path, 'path') ?? '.';
  const glob = validateOptionalString(value.glob, 'glob');
  const caseSensitive = validateOptionalBoolean(
    value.caseSensitive,
    'caseSensitive',
  );
  const fixedStrings = validateOptionalBoolean(
    value.fixedStrings,
    'fixedStrings',
  );
  const maxResults = validateMaxResults(value.maxResults);

  return {
    query,
    glob,
    caseSensitive,
    fixedStrings,
    maxResults,
    resolvedPath: resolveUserPath(searchPath),
  };
};

const runRipgrepSearch = async (options: NormalizedSearch) => {
  const args = ['--line-number', '--column', '--no-heading', '--color', 'never'];

  if (options.caseSensitive === false) {
    args.push('--ignore-case');
  } else if (options.caseSensitive === true) {
    args.push('--case-sensitive');
  } else {
    args.push('--smart-case');
  }
  if (options.fixedStrings) {
    args.push('--fixed-strings');
  }
  if (options.glob) {
    args.push('--glob', options.glob);
  }
  args.push(
    '--max-count',
    String(options.maxResults),
    '--',
    options.query,
    options.resolvedPath,
  );

  try {
    const { stdout, stderr } = await execFileAsync('rg', args, {
      maxBuffer: MAX_BUFFER_BYTES,
    });
    const matches = stdout ? stdout.trimEnd().split('\n') : [];
    return buildSearchResult(options, matches, stderr);
  } catch (error) {
    if (isNoMatchError(error)) {
      return buildSearchResult(options, [], error.stderr ?? '');
    }
    throw error;
  }
};

const runNodeSearch = async (options: NormalizedSearch) => {
  const matches: string[] = [];
  const rootStat = await stat(options.resolvedPath);

  if (rootStat.isDirectory()) {
    await collectDirectoryMatches(
      options.resolvedPath,
      options.resolvedPath,
      options,
      matches,
    );
  } else if (rootStat.isFile()) {
    await collectFileMatches(
      options.resolvedPath,
      options.resolvedPath,
      options,
      matches,
    );
  }

  return buildSearchResult(options, matches);
};

const collectDirectoryMatches = async (
  root: string,
  directory: string,
  options: NormalizedSearch,
  matches: string[],
): Promise<void> => {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await collectDirectoryMatches(root, fullPath, options, matches);
      }
      continue;
    }

    if (
      entry.isFile() &&
      matchesGlob(path.relative(root, fullPath), options.glob)
    ) {
      await collectFileMatches(fullPath, root, options, matches);
    }
  }
};

const collectFileMatches = async (
  fullPath: string,
  root: string,
  options: NormalizedSearch,
  matches: string[],
): Promise<void> => {
  let content: string;
  try {
    content = await readFile(fullPath, 'utf8');
  } catch {
    return;
  }

  const regex = createQueryRegex(options);
  const displayPath =
    fullPath === root ? fullPath : toPosixPath(path.relative(root, fullPath));
  const lines = content.split('\n');
  let matchedLines = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = regex.exec(line);
    if (!match) {
      continue;
    }

    const column = (match.index ?? 0) + 1;
    matches.push(`${displayPath}:${index + 1}:${column}:${line}`);
    matchedLines += 1;
    if (matchedLines >= options.maxResults) {
      return;
    }
  }
};

const createQueryRegex = (options: NormalizedSearch): RegExp => {
  const source = options.fixedStrings
    ? escapeRegExp(options.query)
    : options.query;
  const useIgnoreCase =
    options.caseSensitive === false ||
    (options.caseSensitive === undefined && !/[A-Z]/.test(options.query));
  return new RegExp(source, useIgnoreCase ? 'i' : '');
};

const matchesGlob = (
  relativePath: string,
  glob: string | undefined,
): boolean => {
  if (!glob) {
    return true;
  }

  const normalizedPath = toPosixPath(relativePath);
  const pattern = toPosixPath(glob);
  const basename = normalizedPath.split('/').pop() ?? normalizedPath;

  if (pattern.startsWith('!')) {
    const excluded = globToRegExp(pattern.slice(1));
    return !excluded.test(normalizedPath) && !excluded.test(basename);
  }
  if (!pattern.includes('/')) {
    return globToRegExp(pattern).test(basename);
  }
  if (pattern.startsWith('**/')) {
    return (
      globToRegExp(pattern).test(normalizedPath) ||
      globToRegExp(pattern.slice(3)).test(normalizedPath)
    );
  }
  return globToRegExp(pattern).test(normalizedPath);
};

const globToRegExp = (pattern: string): RegExp => {
  const source = escapeRegExp(pattern)
    .replace(/\\\*\\\*/g, '\0')
    .replace(/\\\*/g, '[^/]*')
    .replace(/\\\?/g, '[^/]')
    .replace(/\0/g, '.*');
  return new RegExp(`^${source}$`);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const buildSearchResult = (
  options: NormalizedSearch,
  matches: string[],
  stderr = '',
) => ({
  query: options.query,
  path: options.resolvedPath,
  glob: options.glob,
  caseSensitive: options.caseSensitive ?? 'smart',
  fixedStrings: options.fixedStrings ?? false,
  maxResults: options.maxResults,
  matchCount: matches.length,
  matches,
  stderr,
});

const validateRequiredString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
};

const validateOptionalString = (
  value: unknown,
  name: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
};

const validateOptionalBoolean = (
  value: unknown,
  name: string,
): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${name} flag`);
  }
  return value;
};

const validateMaxResults = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_MAX_RESULTS;
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_RESULTS
  ) {
    throw new Error('Invalid maxResults');
  }
  return value;
};

const isNoMatchError = (
  error: unknown,
): error is Error & { code: number; stdout?: string; stderr?: string } =>
  error instanceof Error &&
  'code' in error &&
  (error as { code?: unknown }).code === 1;

const isCommandMissing = (
  error: unknown,
): error is Error & { code?: string } =>
  error instanceof Error && (error as { code?: unknown }).code === 'ENOENT';
