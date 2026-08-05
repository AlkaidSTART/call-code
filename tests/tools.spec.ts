import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getEnvironmentTool,
  listFilesTool,
  readFileTool,
  writeFileTool,
} from '@tools';
import { resolveUserPath } from '@tools/pathUtils';

const previousDesktopDir = process.env.AGENT_DESKTOP_DIR;
let tempDesktop: string | undefined;

afterEach(async () => {
  process.env.AGENT_DESKTOP_DIR = previousDesktopDir;
  if (tempDesktop) {
    await rm(tempDesktop, { recursive: true, force: true });
    tempDesktop = undefined;
  }
});

describe('tools', () => {
  it('reports local environment locations', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-desktop-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;

    const result = await getEnvironmentTool.run({});

    expect(result.locations.cwd.path).toBe(process.cwd());
    expect(result.locations.desktop.path).toBe(tempDesktop);
    expect(result.pathAliases).toContain('桌面/...');
  });

  it('resolves desktop aliases for file operations', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-desktop-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;

    const writeResult = await writeFileTool.run({
      path: '桌面/hello-agent.txt',
      content: 'hello desktop',
    });

    expect(writeResult.path).toBe(path.join(tempDesktop, 'hello-agent.txt'));
    await expect(readFile(writeResult.path, 'utf8')).resolves.toBe(
      'hello desktop',
    );

    const readResult = await readFileTool.run({
      path: 'desktop:/hello-agent.txt',
    });
    expect(readResult.content).toBe('hello desktop');

    const listResult = await listFilesTool.run({ path: 'Desktop' });
    expect(listResult.path).toBe(tempDesktop);
    expect(listResult.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'hello-agent.txt',
          type: 'file',
        }),
      ]),
    );
  });

  it('resolves relative paths inside the current working directory', () => {
    expect(resolveUserPath('README.md')).toBe(
      path.join(process.cwd(), 'README.md'),
    );
  });
});
