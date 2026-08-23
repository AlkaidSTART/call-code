import type { ContextMessage } from '../context/context-types.js';
import { persistCompactionEntry, type CompactResult } from '../compaction/compaction.js';
import type { TaskState } from '../core/state.js';
import type { ToolCallAction } from '../protocol/action.js';
import type { SessionStoreLike } from '../session/store-types.js';
import { readTaskHistory } from '../session/history.js';
import {
  appendTaskEntry,
  appendTaskRecord,
  ensureTaskSession,
} from '../session/task-session.js';

export interface SessionRuntime {
  history: ContextMessage[];
  appendAssistant(content: string): void;
  recordToolCall(parsed: ToolCallAction): void;
  appendToolResult(toolName: string, content: string): void;
  persistCompaction(result: CompactResult): void;
}

const noop = (): void => undefined;

/** 收敛 runLoop 的会话恢复与持久化细节，store 为空时提供无副作用实现。 */
export const createSessionRuntime = (
  task: TaskState,
  store: SessionStoreLike | null,
): SessionRuntime => {
  if (!store) {
    return {
      history: [],
      appendAssistant: noop,
      recordToolCall: noop,
      appendToolResult: noop,
      persistCompaction: noop,
    };
  }

  ensureTaskSession(task, store);
  appendTaskEntry(task, { role: 'user', content: task.input, tags: ['task-input'] }, store);

  return {
    history: readTaskHistory(task, { limit: 100 }, store),
    appendAssistant(content) {
      appendTaskEntry(
        task,
        { role: 'assistant', content, tags: ['model-response'] },
        store,
      );
    },
    recordToolCall(parsed) {
      appendTaskRecord(task, {
        type: 'tool_call',
        opKind: parsed.tool,
        payload: parsed,
      }, store);
    },
    appendToolResult(toolName, content) {
      appendTaskEntry(
        task,
        { role: 'tool', content, tool: toolName, tags: ['tool-result', toolName] },
        store,
      );
      appendTaskRecord(task, {
        type: 'tool_result',
        opKind: toolName,
        payload: { tool: toolName, content },
      }, store);
    },
    persistCompaction(result) {
      persistCompactionEntry(task.id, result, store);
    },
  };
};
