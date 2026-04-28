export const readFileTool = {
  name: 'read_file',
  description: 'Read a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to read file from',
      },
    },
    required: ['path'],
  },
  run: async (input: any) => {
    const { path } = input;
  },
};
