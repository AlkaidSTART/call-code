import { streamLLM } from '@core/llm';
import { ContextBuilder, type ContextMessage } from '@core/context';
import { systemPrompt } from '@prompt/systemPrompt';
import type { StreamHandlers } from '@core/llm';

const contextBuilder = new ContextBuilder(8000);

const shouldContinueLoop = (response: string) => {
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
        system: systemPrompt,
        history,
        input,
      });

      const res = await streamLLM(messages, {
        ...handlers,
        onStart: () => {
          handlers.onTrace?.(`第 ${step} 轮流式输出已开始`);
          handlers.onStart?.();
        },
        onDelta: (delta) => {
          handlers.onDelta?.(delta);
        },
        onComplete: (content) => {
          handlers.onTrace?.(`第 ${step} 轮流式输出完成`);
          handlers.onComplete?.(content);
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
      console.log(`[Step ${step}] LLM回复：`, res);

      if (!shouldContinueLoop(res)) {
        return res;
      }

      handlers.onTrace?.(`第 ${step} 轮判断任务未完成，准备进入下一轮`);
    } catch (error) {
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return '已超出最大循环次数';
};
