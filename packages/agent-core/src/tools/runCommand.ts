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
  },
};
