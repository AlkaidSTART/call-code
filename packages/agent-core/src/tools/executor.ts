import { tools } from '@tools';
import { enforceToolPermission } from '@policy/guard';
import type { AgentMode } from '@core/state';
import type { AgentResponse } from '@protocol/parser';

export interface ToolExecutionResult {
  content: string;
  trace: string;
}

export const executeToolCall = async (
  mode: AgentMode,
  parsed: AgentResponse,
): Promise<ToolExecutionResult> => {
  const toolName = parsed.tool;
  if (!toolName) {
    return {
      content: JSON.stringify({
        type: 'tool_result',
        tool: null,
        ok: false,
        error: 'Missing tool name',
      }),
      trace: '缺少工具名，继续下一轮',
    };
  }

  const permission = enforceToolPermission(mode, toolName);
  if (!permission.ok) {
    return {
      content: JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        ok: false,
        error: permission.error,
      }),
      trace: `工具 ${toolName} 权限受限，继续下一轮`,
    };
  }

  const tool = tools.find((item) => item.name === toolName);
  if (!tool) {
    return {
      content: JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        ok: false,
        error: `Unknown tool: ${toolName}`,
      }),
      trace: `未找到工具 ${toolName}，继续下一轮`,
    };
  }

  try {
    const result = await tool.run(parsed.arguments ?? {});
    return {
      content: JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        ok: true,
        result,
      }),
      trace: `工具 ${toolName} 执行成功，继续下一轮`,
    };
  } catch (error) {
    return {
      content: JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      trace: `工具 ${toolName} 执行失败，继续下一轮`,
    };
  }
};
