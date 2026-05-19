import { streamLLM } from '@core/llm';
import { ContextBuilder } from '@agent-core/context/context-builder';
import { buildRuntimeContext } from '@agent-core/context/runtime-context';
import type { ContextMessage } from '@agent-core/context/context-types';
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
import {
  archiveShortMemory,
  promoteStableFact,
  writeShortMemory,
} from '@agent-core/memory/memory-writer';
import { retrieveMemoryForTask } from '@agent-core/memory/memory-retriever';

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

      const memory = retrieveMemoryForTask(task.input, task.id);
      const runtimeContext = buildRuntimeContext(contextBuilder, {
        system: `${systemPrompt}\n${getModePrompt(task.mode)}\n${toolPrompt}`,
        history,
        task,
        shortMemory: memory.shortSummary,
        longMemory: memory.longFacts,
        includeHistorySummary: step > 1,
      });

      const res = await streamLLM(runtimeContext.messages, {
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
      writeShortMemory(task, 'assistant', res, ['model-response']);

      const parsed = parseAgentResponse(res);
      if (parsed?.type === 'tool_call' && parsed.tool) {
        const execution = await executeToolCall(task.mode, parsed);
        history.push({
          role: 'user',
          content: execution.content,
        });
        writeShortMemory(task, 'tool', execution.content, ['tool-result', parsed.tool]);
        handlers.onTrace?.(execution.trace);
        continue;
      }

      if (!shouldContinueLoop(res)) {
        archiveShortMemory(task);
        promoteStableFact(task, 'task-objective', task.objective, history);
        return extractFinalText(res);
      }

      handlers.onTrace?.(`第 ${step} 轮判断任务未完成，准备进入下一轮`);
    } catch (error) {
      archiveShortMemory(task);
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  archiveShortMemory(task);
  return '已超出最大循环次数';
};
