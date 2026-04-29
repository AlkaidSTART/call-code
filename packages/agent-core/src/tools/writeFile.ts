import { mkdir, writeFile } from 'node:fs/promises';
import pathModule from 'node:path';

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
    await mkdir(path ? pathModule.dirname(path) : '.', { recursive: true });
    await writeFile(path, content, 'utf8');
    return { path, bytesWritten: Buffer.byteLength(content, 'utf8') };
  },
};
