import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveUserPath } from '@agent-core/harness/tools/pathUtils';

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_RESULTS = 100;
const MAX_RESULTS = 1000;

export const searchTool = {
  name: 'search',
  description: 'Search file contents with ripgrep',
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
    const resolvedPath = resolveUserPath(searchPath);
    const args = ['--line-number', '--column', '--no-heading', '--color', 'never'];

    if (caseSensitive === false) {
      args.push('--ignore-case');
    } else if (caseSensitive === true) {
      args.push('--case-sensitive');
    } else {
      args.push('--smart-case');
    }
    if (fixedStrings) {
      args.push('--fixed-strings');
    }
    if (glob) {
      args.push('--glob', glob);
    }
    args.push('--max-count', String(maxResults), '--', query, resolvedPath);

    try {
      const { stdout, stderr } = await execFileAsync('rg', args, {
        maxBuffer: 10 * 1024 * 1024,
      });
      const matches = stdout ? stdout.trimEnd().split('\n') : [];

      return {
        query,
        path: resolvedPath,
        glob,
        caseSensitive: caseSensitive ?? 'smart',
        fixedStrings: fixedStrings ?? false,
        maxResults,
        matchCount: matches.length,
        matches,
        stderr,
      };
    } catch (error) {
      if (isNoMatchError(error)) {
        return {
          query,
          path: resolvedPath,
          glob,
          caseSensitive: caseSensitive ?? 'smart',
          fixedStrings: fixedStrings ?? false,
          maxResults,
          matchCount: 0,
          matches: [],
          stderr: error.stderr ?? '',
        };
      }
      throw error;
    }
  },
};

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
