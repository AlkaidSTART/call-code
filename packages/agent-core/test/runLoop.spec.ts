import { vi, describe, it, expect } from 'vitest';

// Mock callLLM to ensure no network calls during tests
vi.mock('../src/core/llm', () => ({
  callLLM: vi.fn(async () => 'mock response'),
}));

import { runLoop } from '../src/core/loop';
import { callLLM } from '../src/core/llm';

describe('runLoop', () => {
  it('does not call callLLM because of current step logic and returns undefined', async () => {
    const spy = vi.spyOn(await import('../src/core/llm'), 'callLLM');
    const res = await runLoop('hello');
    expect(spy).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });
});
