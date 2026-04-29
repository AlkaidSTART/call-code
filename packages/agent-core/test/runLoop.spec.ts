import { vi, describe, it, expect } from 'vitest';

// Mock streamLLM to ensure no network calls during tests
vi.mock('@core/llm', () => ({
  streamLLM: vi.fn(),
}));

import { runLoop } from '../src/core/loop';
import { streamLLM } from '@core/llm';

describe('runLoop', () => {
  it('executes a tool call and continues until final', async () => {
    vi.mocked(streamLLM)
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'tool_call',
          tool: 'get_environment',
          arguments: {},
          message: 'inspect environment',
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          type: 'final',
          tool: null,
          arguments: null,
          message: '环境已感知',
        }),
      );

    const traces: string[] = [];
    const res = await runLoop('看看当前环境', {
      onTrace: (message) => traces.push(message),
    });

    expect(streamLLM).toHaveBeenCalledTimes(2);
    expect(traces).toContain('工具 get_environment 执行成功，继续下一轮');
    expect(res).toBe('环境已感知');
  });
});
