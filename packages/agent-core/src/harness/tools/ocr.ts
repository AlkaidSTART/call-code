import { readFile } from 'node:fs/promises';
import Tesseract from 'tesseract.js';
import { resolveUserPath } from '@agent-core/harness/tools/pathUtils';

const DEFAULT_LANG = 'eng';

export const ocrImageTool = {
  name: 'ocr_image',
  description: 'Recognize text from an image file using Tesseract OCR',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the image file to recognize',
      },
      lang: {
        type: 'string',
        description:
          'Optional Tesseract language code, e.g. eng or chi_sim+eng',
      },
    },
    required: ['path'],
  },
  run: async (input: any) => {
    const { path, lang } = input;
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path');
    }

    const language =
      typeof lang === 'string' && lang.trim() ? lang.trim() : DEFAULT_LANG;
    const resolvedPath = resolveUserPath(path);
    const image = await readFile(resolvedPath);

    const worker = await Tesseract.createWorker(language, undefined, {
      logger: () => {},
    });

    try {
      const { data } = await worker.recognize(image);
      return {
        requestedPath: path,
        path: resolvedPath,
        language,
        text: data.text,
        confidence: data.confidence,
      };
    } finally {
      await worker.terminate();
    }
  },
};
