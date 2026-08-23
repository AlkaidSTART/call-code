import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bashTool,
  getEnvironmentTool,
  gitDiffTool,
  ocrImageTool,
  readFileTool,
  searchTool,
  tools,
  writeFileTool,
} from '@tools';
import { executeToolCall } from '@tools/executor';
import { resolveUserPath } from '@tools/pathUtils';
import { toolPrompt } from '@prompt/tool';

const execFileAsync = promisify(execFile);
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
  it('registers every tool advertised in the prompt', () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      'get_environment',
      'read_file',
      'write_file',
      'search',
      'bash',
      'git_diff',
      'ocr_image',
    ]);
    expect(ocrImageTool.name).toBe('ocr_image');
    expect(toolPrompt).toContain('可用工具仅有以下 7 个');
    expect(toolPrompt).not.toContain('list_files');
    expect(toolPrompt).not.toContain('run_command');
    for (const tool of tools) {
      expect(toolPrompt).toContain(tool.name);
    }
  });

  it('executor resolves registered tools and reports unknown tools', async () => {
    const success = await executeToolCall('build', {
      type: 'tool_call',
      tool: 'get_environment',
      arguments: {},
      message: 'inspect environment',
    });
    expect(JSON.parse(success.content)).toMatchObject({
      ok: true,
      tool: 'get_environment',
    });

    const unknown = await executeToolCall('build', {
      type: 'tool_call',
      tool: 'missing_tool',
      arguments: {},
      message: 'unknown',
    });
    expect(JSON.parse(unknown.content)).toMatchObject({
      ok: false,
      tool: 'missing_tool',
      error: 'Unknown tool: missing_tool',
    });

    const blocked = await executeToolCall('plan', {
      type: 'tool_call',
      tool: 'read_file',
      arguments: { path: 'README.md' },
      message: 'blocked',
    });
    expect(JSON.parse(blocked.content)).toMatchObject({
      ok: false,
      tool: 'read_file',
    });
  });

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
  });

  it('resolves relative paths inside the current working directory', () => {
    expect(resolveUserPath('README.md')).toBe(
      path.join(process.cwd(), 'README.md'),
    );
  });

  it('searches file contents with path, glob and result limits', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-search-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;
    await writeFile(path.join(tempDesktop, 'one.ts'), 'Alpha needle\nneedle again\n');
    await writeFile(path.join(tempDesktop, 'two.txt'), 'needle ignored\n');

    const result = await searchTool.run({
      query: 'needle',
      path: 'desktop:/',
      glob: '*.ts',
      caseSensitive: false,
      fixedStrings: true,
      maxResults: 1,
    });

    expect(result).toMatchObject({
      path: tempDesktop,
      glob: '*.ts',
      caseSensitive: false,
      fixedStrings: true,
      maxResults: 1,
      matchCount: 1,
    });
    expect(result.matches[0]).toContain('one.ts:1:7:Alpha needle');
  });

  it('returns an empty search result and validates arguments', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-search-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;
    await writeFile(path.join(tempDesktop, 'sample.txt'), 'content\n');

    const result = await searchTool.run({
      query: 'missing',
      path: 'desktop:/',
    });
    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);

    await expect(searchTool.run({ query: '   ' })).rejects.toThrow(
      'Invalid query',
    );
    await expect(
      searchTool.run({ query: 'content', caseSensitive: 'yes' }),
    ).rejects.toThrow('Invalid caseSensitive flag');
    await expect(
      searchTool.run({ query: 'content', maxResults: 0 }),
    ).rejects.toThrow('Invalid maxResults');
  });

  it('runs Bash commands with a resolved working directory', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-bash-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;

    const result = await bashTool.run({
      command: '[[ -n "$BASH_VERSION" ]] && printf bash',
      cwd: 'desktop:/',
    });

    expect(result.cwd).toBe(tempDesktop);
    expect(result.stdout).toBe('bash');
  });

  it('shows unstaged and staged Git diffs with optional path filtering', async () => {
    tempDesktop = await mkdtemp(path.join(os.tmpdir(), 'agent-git-diff-'));
    process.env.AGENT_DESKTOP_DIR = tempDesktop;
    const filePath = path.join(tempDesktop, 'sample.txt');

    await execFileAsync('git', ['init'], { cwd: tempDesktop });
    await writeFile(filePath, 'one\n', 'utf8');
    await execFileAsync('git', ['add', 'sample.txt'], { cwd: tempDesktop });
    await writeFile(filePath, 'two\n', 'utf8');

    const unstaged = await gitDiffTool.run({
      cwd: 'desktop:/',
      path: 'sample.txt',
    });
    expect(unstaged).toMatchObject({
      cwd: tempDesktop,
      staged: false,
      path: 'sample.txt',
      hasChanges: true,
    });
    expect(unstaged.stdout).toContain('-one');
    expect(unstaged.stdout).toContain('+two');

    await execFileAsync('git', ['add', 'sample.txt'], { cwd: tempDesktop });
    const staged = await gitDiffTool.run({
      cwd: 'desktop:/',
      staged: true,
    });
    expect(staged.staged).toBe(true);
    expect(staged.hasChanges).toBe(true);
    expect(staged.stdout).toContain('+two');

    const cleanWorkingTree = await gitDiffTool.run({ cwd: 'desktop:/' });
    expect(cleanWorkingTree.hasChanges).toBe(false);
    expect(cleanWorkingTree.stdout).toBe('');
  });

  it('validates Git diff arguments', async () => {
    await expect(gitDiffTool.run({ staged: 'yes' })).rejects.toThrow(
      'Invalid staged flag',
    );
    await expect(gitDiffTool.run({ path: '   ' })).rejects.toThrow(
      'Invalid path',
    );
  });

  it('executor converts Bash failures into failed observations', async () => {
    const execution = await executeToolCall('build', {
      type: 'tool_call',
      tool: 'bash',
      arguments: {
        command: 'exit 7',
      },
      message: 'should fail',
    });

    expect(JSON.parse(execution.content)).toMatchObject({
      ok: false,
      tool: 'bash',
    });
  });
});
