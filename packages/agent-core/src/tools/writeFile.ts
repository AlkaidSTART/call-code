import { mkdir, writeFile } from 'node:fs/promises';
import pathModule from 'node:path';
import { resolveUserPath } from '@tools/pathUtils';

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
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path');
    }
    if (typeof content !== 'string') {
      throw new Error('Invalid content');
    }
    const resolvedPath = resolveUserPath(path);
    await mkdir(pathModule.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, content, 'utf8');
    return {
      requestedPath: path,
      path: resolvedPath,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    };
  },
};
