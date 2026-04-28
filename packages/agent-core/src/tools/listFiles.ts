export const listFilesTool = {
  name: 'list_files',
  description: 'List files in a directory',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to list files in',
      },
    },
    required: ['path'],
  },
  run: async (input: any) => {
    const { path } = input;
  },
};
