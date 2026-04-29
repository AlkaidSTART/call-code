import { vi, describe, it, expect } from 'vitest';

// Mock runLoop to avoid calling the real loop implementation
vi.mock('@core/loop', () => ({
  runLoop: vi.fn(async (input: string) => `handled:${input}`),
}));

import { agent } from '../src/core/agent';
import { runLoop } from '@core/loop';

describe('agent', () => {
  it('calls runLoop with input and returns the final response', async () => {
    const res = await agent('task');
    expect(runLoop).toHaveBeenCalledWith('task', {});
    expect(res).toBe('handled:task');
  });
});
