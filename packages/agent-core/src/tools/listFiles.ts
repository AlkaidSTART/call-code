import { readdir } from 'node:fs/promises';
import pathModule from 'node:path';
import { resolveUserPath } from '@tools/pathUtils';

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
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path');
    }
    const resolvedPath = resolveUserPath(path);
    const entries = await readdir(resolvedPath, { withFileTypes: true });
    return {
      requestedPath: path,
      path: resolvedPath,
      entries: entries.map((entry) => ({
        name: entry.name,
        path: pathModule.join(resolvedPath, entry.name),
        type: entry.isDirectory() ? 'directory' : 'file',
      })),
    };
  },
};
