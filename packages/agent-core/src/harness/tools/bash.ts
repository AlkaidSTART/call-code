import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveUserPath } from '@agent-core/harness/tools/pathUtils';

const execFileAsync = promisify(execFile);

export const bashTool = {
  name: 'bash',
  description: 'Run a command with Bash',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The Bash command to run',
      },
      cwd: {
        type: 'string',
        description:
          'Optional working directory. Supports aliases like desktop:/, ~/ and temp:/.',
      },
    },
    required: ['command'],
  },
  run: async (input: unknown) => {
    const value = input as { command?: unknown; cwd?: unknown };
    const { command, cwd } = value;
    if (typeof command !== 'string' || !command.trim()) {
      throw new Error('Invalid command');
    }

    const resolvedCwd =
      typeof cwd === 'string' && cwd.trim() ? resolveUserPath(cwd) : undefined;
    const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
      maxBuffer: 10 * 1024 * 1024,
      cwd: resolvedCwd,
    });

    return {
      command,
      cwd: resolvedCwd || process.cwd(),
      stdout,
      stderr,
    };
  },
};
