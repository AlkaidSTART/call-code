import { runLoop } from '@core/loop';
import type { StreamHandlers } from '@core/llm';
import { createTaskState, type AgentMode } from '@core/state';

export interface AgentOptions {
  mode?: AgentMode;
  objective?: string;
  constraints?: string[];
  workspace?: string;
}

export const agent = async (
  input: string,
  handlers: StreamHandlers = {},
  options: AgentOptions = {},
): Promise<string> => {
  const task = createTaskState(input, options);
  const res = await runLoop(task, handlers);
  return res || '';
};
