import { tools } from '@tools';
import { enforceToolPermission } from '@policy/guard';
import type { AgentMode } from '@core/state';
import type { ToolCallAction } from '@protocol/action';
import { createToolResultObservation } from '@protocol/observation';

export interface ToolExecutionResult {
  content: string;
  trace: string;
}

export const executeToolCall = async (
  mode: AgentMode,
  parsed: ToolCallAction,
): Promise<ToolExecutionResult> => {
  const toolName = parsed.tool;

  const permission = enforceToolPermission(mode, toolName);
  if (!permission.ok) {
    const observation = createToolResultObservation({
      tool: toolName,
      ok: false,
      error: permission.error,
    });
    return {
      content: JSON.stringify(observation),
      trace: `工具 ${toolName} 权限受限，继续下一轮`,
    };
  }

  const tool = tools.find((item) => item.name === toolName);
  if (!tool) {
    const observation = createToolResultObservation({
      tool: toolName,
      ok: false,
      error: `Unknown tool: ${toolName}`,
    });
    return {
      content: JSON.stringify(observation),
      trace: `未找到工具 ${toolName}，继续下一轮`,
    };
  }

  try {
    const result = await tool.run(parsed.arguments ?? {});
    const observation = createToolResultObservation({
      tool: toolName,
      ok: true,
      result,
    });
    return {
      content: JSON.stringify(observation),
      trace: `工具 ${toolName} 执行成功，继续下一轮`,
    };
  } catch (error) {
    const observation = createToolResultObservation({
      tool: toolName,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      content: JSON.stringify(observation),
      trace: `工具 ${toolName} 执行失败，继续下一轮`,
    };
  }
};
