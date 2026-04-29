import { streamLLM } from '@core/llm';
import { ContextBuilder, type ContextMessage } from '@core/context';
import { systemPrompt } from '@prompt/system';
import { toolPrompt } from '@prompt/tool';
import { tools } from '@tools';
import type { StreamHandlers } from '@core/llm';

const contextBuilder = new ContextBuilder(8000);

type AgentResponse = {
  type: 'tool_call' | 'final' | string;
  tool: string | null;
  arguments: Record<string, unknown> | null;
  message: string;
};
// 解析模型响应的函数
const parseAgentResponse = (response: string): AgentResponse | null => {
  try {
    const parsed = JSON.parse(response) as AgentResponse;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!('type' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};
// 判断是否继续循环的函数
const shouldContinueLoop = (response: string) => {
  const parsed = parseAgentResponse(response);
  if (parsed?.type === 'tool_call') {
    return true;
  }
  if (parsed?.type === 'final') {
    return false;
  }

  const normalized = response.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const solvedSignals = [
    '已完成',
    '完成',
    '已解决',
    '解决了',
    'done',
    'finished',
  ];
  if (
    solvedSignals.some((signal) => normalized.includes(signal.toLowerCase()))
  ) {
    return false;
  }

  const unresolvedSignals = [
    '还需要',
    '仍需',
    '需要继续',
    '请继续',
    '下一步',
    '继续执行',
    '待完成',
    '待处理',
    '未完成',
    '未解决',
    '需要进一步',
  ];

  return unresolvedSignals.some((signal) =>
    normalized.includes(signal.toLowerCase()),
  );
};

export const runLoop = async (
  input: string,
  handlers: StreamHandlers = {},
): Promise<string> => {
  const history: ContextMessage[] = [];
  let step = 0;
  const maxSteps = 10;

  while (step < maxSteps) {
    step++;
    try {
      handlers.onTrace?.(`第 ${step} 轮开始，正在请求模型...`);

      const messages = contextBuilder.build({
        system: `${systemPrompt}\n${toolPrompt}`,
        history,
        input,
      });

      const res = await streamLLM(messages, {
        ...handlers,
        onStart: () => {
          handlers.onTrace?.(`第 ${step} 轮流式输出已开始`);
          handlers.onStart?.();
        },
        onComplete: (content) => {
          handlers.onTrace?.(`第 ${step} 轮流式输出完成`);
        },
        onError: (error) => {
          handlers.onTrace?.(`第 ${step} 轮请求失败`);
          handlers.onError?.(error);
        },
      });
      if (!res) {
        return '无法获取 LLM 回复';
      }
      history.push({
        role: 'assistant',
        content: res,
      });

      const parsed = parseAgentResponse(res);
      if (parsed?.type === 'tool_call' && parsed.tool) {
        const tool = tools.find((item) => item.name === parsed.tool);
        if (!tool) {
          history.push({
            role: 'user',
            content: JSON.stringify({
              type: 'tool_result',
              tool: parsed.tool,
              ok: false,
              error: `Unknown tool: ${parsed.tool}`,
            }),
          });
          handlers.onTrace?.(`未找到工具 ${parsed.tool}，继续下一轮`);
          continue;
        }

        try {
          const result = await tool.run(parsed.arguments ?? {});
          history.push({
            role: 'user',
            content: JSON.stringify({
              type: 'tool_result',
              tool: parsed.tool,
              ok: true,
              result,
            }),
          });
          handlers.onTrace?.(`工具 ${parsed.tool} 执行成功，继续下一轮`);
          continue;
        } catch (error) {
          history.push({
            role: 'user',
            content: JSON.stringify({
              type: 'tool_result',
              tool: parsed.tool,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          });
          handlers.onTrace?.(`工具 ${parsed.tool} 执行失败，继续下一轮`);
          continue;
        }
      }

      if (!shouldContinueLoop(res)) {
        if (parsed?.type === 'final') {
          return parsed.message || '';
        }
        return res;
      }

      handlers.onTrace?.(`第 ${step} 轮判断任务未完成，准备进入下一轮`);
    } catch (error) {
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return '已超出最大循环次数';
};
