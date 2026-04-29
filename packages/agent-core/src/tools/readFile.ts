import { readFile } from 'node:fs/promises';

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
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path');
    }
    const content = await readFile(path, 'utf8');
    return { path, content };
  },
};
