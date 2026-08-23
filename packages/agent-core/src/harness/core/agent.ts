import { runLoop } from '../runtime/run-loop.js';
import type { StreamHandlers } from './llm.js';
import { createTaskState, type AgentMode } from './state.js';

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
  const res = await runLoop(task, handlers, { persist: true });
  return res || '';
};
