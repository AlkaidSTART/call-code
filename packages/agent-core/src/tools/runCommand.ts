import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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
    },
    required: ['command'],
  },
  run: async (input: any) => {
    const { command } = input;
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command');
    }
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      command,
      stdout,
      stderr,
    };
  },
};
