import { runLoop } from '@core/loop';
import type { StreamHandlers } from '@core/llm';

export const agent = async (
  input: string,
  handlers: StreamHandlers = {},
): Promise<string> => {
  const res = await runLoop(input, handlers);
  return res || '';
};
