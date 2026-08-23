import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createWorker } = vi.hoisted(() => ({
  createWorker: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  default: {
    createWorker,
  },
}));

import { ocrImageTool } from '@tools/ocr';
import { executeToolCall } from '@tools/executor';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  vi.clearAllMocks();
});

describe('ocr_image tool', () => {
  it('reads an image file and returns recognized text', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-ocr-'));
    const imagePath = path.join(tempDir, 'sample.png');
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const terminate = vi.fn().mockResolvedValue(undefined);
    const recognize = vi.fn().mockResolvedValue({
      data: {
        text: 'Hello OCR',
        confidence: 92,
      },
    });

    createWorker.mockResolvedValue({ recognize, terminate });

    const result = await ocrImageTool.run({
      path: imagePath,
      lang: 'chi_sim+eng',
    });

    expect(result).toMatchObject({
      path: imagePath,
      language: 'chi_sim+eng',
      text: 'Hello OCR',
      confidence: 92,
    });
    expect(createWorker).toHaveBeenCalledWith(
      'chi_sim+eng',
      undefined,
      expect.objectContaining({ logger: expect.any(Function) }),
    );
    expect(recognize).toHaveBeenCalledWith(expect.any(Buffer));
    expect(terminate).toHaveBeenCalled();
  });

  it('defaults to eng when lang is omitted', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-ocr-'));
    const imagePath = path.join(tempDir, 'sample.png');
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const terminate = vi.fn().mockResolvedValue(undefined);
    const recognize = vi.fn().mockResolvedValue({
      data: {
        text: '',
        confidence: 0,
      },
    });

    createWorker.mockResolvedValue({ recognize, terminate });

    const result = await ocrImageTool.run({ path: imagePath });

    expect(result).toMatchObject({ language: 'eng' });
    expect(createWorker).toHaveBeenCalledWith(
      'eng',
      undefined,
      expect.objectContaining({ logger: expect.any(Function) }),
    );
  });

  it('executor dispatches ocr_image through the registered tool list', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-ocr-'));
    const imagePath = path.join(tempDir, 'executor.png');
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const terminate = vi.fn().mockResolvedValue(undefined);
    const recognize = vi.fn().mockResolvedValue({
      data: {
        text: 'Executor OCR',
        confidence: 88,
      },
    });
    createWorker.mockResolvedValue({ recognize, terminate });

    const execution = await executeToolCall('build', {
      type: 'tool_call',
      tool: 'ocr_image',
      arguments: {
        path: imagePath,
        lang: 'eng',
      },
      message: 'recognize image',
    });

    expect(JSON.parse(execution.content)).toMatchObject({
      ok: true,
      tool: 'ocr_image',
      result: {
        text: 'Executor OCR',
        confidence: 88,
      },
    });
    expect(terminate).toHaveBeenCalled();
  });

  it('rejects a missing path before starting OCR', async () => {
    await expect(ocrImageTool.run({})).rejects.toThrow('Invalid path');
    expect(createWorker).not.toHaveBeenCalled();
  });
});
