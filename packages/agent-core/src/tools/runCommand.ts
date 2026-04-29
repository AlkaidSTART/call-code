import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveUserPath } from '@tools/pathUtils';

const execAsync = promisify(exec);

export const runCommandTool = {
  name: 'run_command',
  description: 'Run a command',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to run',
      },
      cwd: {
        type: 'string',
        description:
          'Optional working directory. Supports aliases like desktop:/, ~/ and temp:/.',
      },
    },
    required: ['command'],
  },
  run: async (input: any) => {
    const { command, cwd } = input;
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command');
    }
    const resolvedCwd =
      typeof cwd === 'string' && cwd.trim() ? resolveUserPath(cwd) : undefined;
    const { stdout, stderr } = await execAsync(command, {
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
