import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));

vi.mock('node:child_process', () => ({ execFile: mockExecFile }));

import { searchTool } from '@tools/search';

type ExecCallback = (
  error?: Error | null,
  stdout?: string,
  stderr?: string,
) => void;

const simulateMissingRipgrep = () => {
  mockExecFile.mockImplementation(
    (_command: string, _args: string[], _options: object, callback: ExecCallback) => {
      callback(
        Object.assign(new Error('spawn rg ENOENT'), {
          code: 'ENOENT',
          syscall: 'spawn rg',
          path: 'rg',
        }),
      );
    },
  );
};

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  mockExecFile.mockReset();
});

describe('search tool ripgrep fallback', () => {
  it('uses a built-in search when rg is missing', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-search-fallback-'));
    await writeFile(
      path.join(tempDir, 'one.ts'),
      'Alpha needle\nneedle again\n',
    );
    await writeFile(path.join(tempDir, 'two.txt'), 'needle ignored\n');
    simulateMissingRipgrep();

    const result = await searchTool.run({
      query: 'needle',
      path: tempDir,
      glob: '*.ts',
      caseSensitive: false,
      fixedStrings: true,
      maxResults: 1,
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      'rg',
      expect.any(Array),
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toMatchObject({
      path: tempDir,
      glob: '*.ts',
      caseSensitive: false,
      fixedStrings: true,
      maxResults: 1,
      matchCount: 1,
    });
    expect(result.matches[0]).toContain('one.ts:1:7:Alpha needle');
  });

  it('returns an empty result when the fallback finds nothing', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-search-fallback-'));
    await writeFile(path.join(tempDir, 'sample.txt'), 'content\n');
    simulateMissingRipgrep();

    const result = await searchTool.run({
      query: 'missing',
      path: tempDir,
    });

    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
