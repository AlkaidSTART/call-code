import type { TaskState } from '../core/state';
import type { ToolCallAction } from '../protocol/action';
import { executeToolCall, type ToolExecutionResult } from '../tools/executor';
import type { SessionRuntime } from './session-runtime';

/** 执行工具并复用会话运行时记录调用与结果。 */
export const runToolCall = async (
  task: TaskState,
  parsed: ToolCallAction,
  session: SessionRuntime,
): Promise<ToolExecutionResult> => {
  session.recordToolCall(parsed);
  const execution = await executeToolCall(task.mode, parsed);
  session.appendToolResult(parsed.tool, execution.content);
  return execution;
};
