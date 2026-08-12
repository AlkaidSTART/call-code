import { callLLM, streamLLM, type StreamHandlers } from './llm';
import { ContextBuilder } from '../session/context/context-builder';
import { buildRuntimeContext } from '../session/context/runtime-context';
import type { ContextMessage } from '../session/context/context-types';
import { systemPrompt } from '../prompt/system';
import { toolPrompt } from '../prompt/tool';
import { getModePrompt } from '../prompt/modes';
import type { TaskState } from './state';
import {
  extractFinalText,
  parseAgentResponse,
  shouldContinueLoop,
} from '../protocol/parser';
import { isToolCallAction } from '../protocol/action';
import { executeToolCall } from '../session/tools/executor';
import { promoteStableFact } from '../session/memory/memory-writer';
import { retrieveMemoryForTask } from '../session/memory/memory-retriever';
import {
  appendTaskEntry,
  appendTaskRecord,
  ensureTaskSession,
  getSharedSessionStoreOrNull,
  readTaskHistory,
  type SessionStoreLike,
} from '../session/sessionInfo/session-repository';
import {
  DEFAULT_COMPACTION_SETTINGS,
  compact,
  createSummaryMessage,
  persistCompactionEntry,
  prepareMessagesToCompact,
  shouldCompact,
  type CompactionSettings,
  type SummarizeFn,
} from '../compaction/compaction';
import { estimateContextTokens } from '../compaction/utils';

const contextBuilder = new ContextBuilder(8000);

export interface RunLoopOptions {
  /** 是否将会话历史写入 SQLite */
  persist?: boolean;
  /** 自定义 SessionStore，测试时可传入 :memory: 实例 */
  sessionStore?: SessionStoreLike;
  /** 是否启用上下文压缩，可传 false 关闭，或传自定义阈值 */
  compaction?: boolean | CompactionSettings;
  /** 测试或自托管 LLM 时注入摘要生成函数 */
  summarize?: SummarizeFn;
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
  const compactionEnabled =
    options.compaction !== false &&
    (store !== null || options.compaction === true || typeof options.compaction === 'object');
  const compactionSettings: CompactionSettings | null = compactionEnabled
    ? typeof options.compaction === 'object'
      ? options.compaction
      : DEFAULT_COMPACTION_SETTINGS
    : null;
  const summarize: SummarizeFn = options.summarize ?? (async (messages) => callLLM(messages));

  if (store) {
    ensureTaskSession(task, store);
    appendTaskEntry(task, { role: 'user', content: task.input, tags: ['task-input'] }, store);
    history.push(...readTaskHistory(task, { limit: 100 }, store));
  }

  const maybeCompact = async (historyToCompact: ContextMessage[]): Promise<void> => {
    if (!compactionSettings) {
      return;
    }
    const contextWindow =
      compactionSettings.contextWindow ??
      DEFAULT_COMPACTION_SETTINGS.contextWindow ??
      8000;
    if (!shouldCompact(estimateContextTokens(historyToCompact), contextWindow, compactionSettings)) {
      return;
    }

    const preparation = prepareMessagesToCompact(historyToCompact, compactionSettings);
    if (!preparation) {
      return;
    }
    const result = await compact(preparation, { summarize });
    if (!result) {
      return;
    }

    historyToCompact.length = 0;
    historyToCompact.push(createSummaryMessage(result.summary), ...result.retainedTail);
    if (store) {
      persistCompactionEntry(task.id, result, store);
    }
    handlers.onTrace?.(`上下文已压缩到摘要，保留最近 ${result.retainedTail.length} 条消息`);
  };

  let step = 0;
  const maxSteps = 10;

  while (step < maxSteps) {
    step++;
    try {
      handlers.onTrace?.(`第 ${step} 轮开始，正在请求模型...`);
      await maybeCompact(history);

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
