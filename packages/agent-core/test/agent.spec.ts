import { vi, describe, it, expect } from 'vitest';

// Mock runLoop to avoid calling the real loop implementation
vi.mock('../src/core/loop', () => ({
  runLoop: vi.fn(async (input: string) => `handled:${input}`),
}));

import { agent } from '../src/core/agent';
import { runLoop } from '../src/core/loop';

describe('agent', () => {
  it('calls runLoop with input and returns undefined (agent currently returns nothing)', async () => {
    const spy = vi.spyOn(await import('../src/core/loop'), 'runLoop');
    const res = await agent('task');
    expect(spy).toHaveBeenCalledWith('task');
    expect(res).toBeUndefined();
  });
});
