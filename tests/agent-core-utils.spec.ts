import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseJson, stringifyJson } from '../packages/agent-core/src/utils/json';
import { logger } from '../packages/agent-core/src/utils/logger';

describe('agent-core utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseJson returns parsed object and uses fallback for invalid input', () => {
    expect(parseJson('{"ok":true}', null)).toEqual({ ok: true });
    expect(parseJson('bad', { ok: false })).toEqual({ ok: false });
  });

  it('stringifyJson serializes values and falls back on failure', () => {
    expect(stringifyJson({ ok: true })).toBe('{"ok":true}');
    expect(stringifyJson(undefined, 'fallback')).toBe('fallback');
    expect(stringifyJson(1n, 'fallback')).toBe('fallback');
  });

  it('logger routes levels to console methods', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(info).toHaveBeenCalledWith('a');
    expect(warn).toHaveBeenCalledWith('b');
    expect(error).toHaveBeenCalledWith('c');
  });
});
