import { vi, describe, it, expect } from 'vitest';

// Mock runLoop to avoid calling the real loop implementation
vi.mock('@core/loop', () => ({
  runLoop: vi.fn(async () => 'handled:task'),
}));

import { agent } from '../src/core/agent';
import { runLoop } from '@core/loop';

describe('agent', () => {
  it('calls runLoop with input and returns the final response', async () => {
    const res = await agent('task');
    expect(runLoop).toHaveBeenCalledTimes(1);
    expect(runLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'task',
        mode: 'build',
        objective: 'task',
        constraints: [],
        workspace: undefined,
      }),
      {},
    );
    expect(res).toBe('handled:task');
  });
});
