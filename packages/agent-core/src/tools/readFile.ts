import { readFile } from 'node:fs/promises';
import { resolveUserPath } from '@tools/pathUtils';

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
    const resolvedPath = resolveUserPath(path);
    const content = await readFile(resolvedPath, 'utf8');
    return { requestedPath: path, path: resolvedPath, content };
  },
};
