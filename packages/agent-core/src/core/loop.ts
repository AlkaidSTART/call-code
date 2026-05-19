import { streamLLM } from '@core/llm';
import { ContextBuilder, type ContextMessage } from '@agent-core/context/builder';
import { systemPrompt } from '@prompt/system';
import { toolPrompt } from '@prompt/tool';
import { getModePrompt } from '@prompt/modes';
import type { StreamHandlers } from '@core/llm';
import type { TaskState } from '@core/state';
import {
  extractFinalText,
  parseAgentResponse,
  shouldContinueLoop,
} from '@protocol/parser';
import { executeToolCall } from '@tools/executor';

const contextBuilder = new ContextBuilder(8000);

export const runLoop = async (
  task: TaskState,
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
        system: `${systemPrompt}\n${getModePrompt(task.mode)}\n${toolPrompt}`,
        history,
        task,
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
        const execution = await executeToolCall(task.mode, parsed);
        history.push({
          role: 'user',
          content: execution.content,
        });
        handlers.onTrace?.(execution.trace);
        continue;
      }

      if (!shouldContinueLoop(res)) {
        return extractFinalText(res);
      }

      handlers.onTrace?.(`第 ${step} 轮判断任务未完成，准备进入下一轮`);
    } catch (error) {
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return '已超出最大循环次数';
};
