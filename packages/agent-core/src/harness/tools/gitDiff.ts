import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveUserPath } from '@agent-core/harness/tools/pathUtils';

const execFileAsync = promisify(execFile);

export const gitDiffTool = {
  name: 'git_diff',
  description: 'Show Git working tree or staged changes',
  parameters: {
    type: 'object',
    properties: {
      cwd: {
        type: 'string',
        description:
          'Optional Git repository directory. Supports aliases like desktop:/, ~/ and temp:/.',
      },
      staged: {
        type: 'boolean',
        description: 'Show staged changes instead of unstaged changes',
      },
      path: {
        type: 'string',
        description: 'Optional repository-relative path to limit the diff',
      },
    },
  },
  run: async (input: unknown = {}) => {
    const value = input as {
      cwd?: unknown;
      staged?: unknown;
      path?: unknown;
    };
    const { cwd, staged, path } = value;

    if (cwd !== undefined && typeof cwd !== 'string') {
      throw new Error('Invalid cwd');
    }
    if (staged !== undefined && typeof staged !== 'boolean') {
      throw new Error('Invalid staged flag');
    }
    if (path !== undefined && (typeof path !== 'string' || !path.trim())) {
      throw new Error('Invalid path');
    }

    const resolvedCwd =
      typeof cwd === 'string' && cwd.trim()
        ? resolveUserPath(cwd)
        : process.cwd();
    const args = ['diff', '--no-ext-diff', '--no-color'];
    if (staged) {
      args.push('--cached');
    }
    if (typeof path === 'string') {
      args.push('--', path);
    }

    const { stdout, stderr } = await execFileAsync('git', args, {
      maxBuffer: 10 * 1024 * 1024,
      cwd: resolvedCwd,
    });

    return {
      cwd: resolvedCwd,
      staged: staged === true,
      path: typeof path === 'string' ? path : null,
      hasChanges: stdout.length > 0,
      stdout,
      stderr,
    };
  },
};
