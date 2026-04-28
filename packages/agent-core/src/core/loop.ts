import { streamLLM } from '@core/llm';
import { listFilesTool } from '@tools';
import { systemPrompt } from '@prompt/systemPrompt';
import { toolPrompt } from '@prompt/toolPrompt';
import type { StreamHandlers } from '@core/llm';
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const runLoop = async (
  input: string,
  handlers: StreamHandlers = {},
): Promise<string> => {
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: input,
    },
  ];
  let step = 0;
  const maxSteps = 10;

  while (step < maxSteps) {
    step++;
    try {
      handlers.onTrace?.(`第 ${step} 轮开始，正在请求模型...`);

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
      messages.push({
        role: 'assistant',
        content: res,
      });
      console.log(`[Step ${step}] LLM回复：`, res);

      // 如果回复包含完成信号，则返回结果
      if (
        res.includes('完成') ||
        res.includes('已完成') ||
        res.includes('finished')
      ) {
        return res;
      }
    } catch (error) {
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return '已超出最大循环次数';
};
