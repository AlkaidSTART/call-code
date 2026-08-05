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
import { isToolCallAction } from '@protocol/action';
import { executeToolCall } from '@tools/executor';
import { promoteStableFact } from '@agent-core/memory/memory-writer';
import { retrieveMemoryForTask } from '@agent-core/memory/memory-retriever';
import {
  appendTaskEntry,
  appendTaskRecord,
  ensureTaskSession,
  getSharedSessionStoreOrNull,
  readTaskHistory,
  type SessionStoreLike,
} from '@agent-core/session/session-repository';

const contextBuilder = new ContextBuilder(8000);

export interface RunLoopOptions {
  /** 是否将会话历史写入 SQLite */
  persist?: boolean;
  /** 自定义 SessionStore，测试时可传入 :memory: 实例 */
  sessionStore?: SessionStoreLike;
}

export const runLoop = async (
  task: TaskState,
  handlers: StreamHandlers = {},
  options: RunLoopOptions = {},
): Promise<string> => {
  const history: ContextMessage[] = [];
  const store = options.persist === true
    ? (options.sessionStore ?? getSharedSessionStoreOrNull())
    : null;

  if (store) {
    ensureTaskSession(task, store);
    appendTaskEntry(task, { role: 'user', content: task.input, tags: ['task-input'] }, store);
    history.push(...readTaskHistory(task, { limit: 100 }, store));
  }

  let step = 0;
  const maxSteps = 10;

  while (step < maxSteps) {
    step++;
    try {
      handlers.onTrace?.(`第 ${step} 轮开始，正在请求模型...`);

      const memory = retrieveMemoryForTask(task.input);
      const runtimeContext = buildRuntimeContext(contextBuilder, {
        system: `${systemPrompt}\n${getModePrompt(task.mode)}\n${toolPrompt}`,
        history,
        task,
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
      if (store) {
        appendTaskEntry(task, { role: 'assistant', content: res, tags: ['model-response'] }, store);
      }

      const parsed = parseAgentResponse(res);
      if (parsed && isToolCallAction(parsed)) {
        if (store) {
          appendTaskRecord(task, {
            type: 'tool_call',
            opKind: parsed.tool,
            payload: parsed,
          }, store);
        }
        const execution = await executeToolCall(task.mode, parsed);
        history.push({
          role: 'user',
          content: execution.content,
        });
        if (store) {
          appendTaskEntry(task, { role: 'tool', content: execution.content, tool: parsed.tool, tags: ['tool-result', parsed.tool] }, store);
          appendTaskRecord(task, {
            type: 'tool_result',
            opKind: parsed.tool,
            payload: {
              tool: parsed.tool,
              content: execution.content,
            },
          }, store);
        }
        handlers.onTrace?.(execution.trace);
        continue;
      }

      if (!shouldContinueLoop(res)) {
        promoteStableFact(task, 'task-objective', task.objective, history);
        return extractFinalText(res);
      }

      handlers.onTrace?.(`第 ${step} 轮判断任务未完成，准备进入下一轮`);
    } catch (error) {
      return `执行出错: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return '已超出最大循环次数';
};
