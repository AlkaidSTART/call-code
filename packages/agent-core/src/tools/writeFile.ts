export const writeFileTool = {
  name: 'write_file',
  description: 'Write a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to write file to',
      },
      content: {
        type: 'string',
        description: 'The content to write to file',
      },
    },
    required: ['path', 'content'],
  },
  run: async (input: any) => {
    const { path, content } = input;
  },
};
