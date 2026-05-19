import type { TaskState } from '@core/state';
import { createTaskContext } from '@agent-core/context/task-context';
import { summarizeHistory } from '@agent-core/context/context-summarizer';
import { ContextBuilder } from '@agent-core/context/context-builder';
import type {
  ContextMessage,
  RuntimeContext,
} from '@agent-core/context/context-types';

export interface BuildRuntimeContextInput {
  system: string;
  history: ContextMessage[];
  task: TaskState;
  shortMemory?: string;
  longMemory?: string[];
  includeHistorySummary?: boolean;
}

export const buildRuntimeContext = (
  builder: ContextBuilder,
  input: BuildRuntimeContextInput,
): RuntimeContext => {
  const messages: ContextMessage[] = [{ role: 'system', content: input.system }];
  const taskContext = createTaskContext(input.task);

  messages.push({
    role: 'system',
    content: JSON.stringify({
      type: 'task_state',
      ...taskContext,
    }),
  });

  if (input.longMemory?.length) {
    messages.push({
      role: 'system',
      content: `长期记忆:\n${input.longMemory.map((item) => `- ${item}`).join('\n')}`,
    });
  }

  if (input.shortMemory) {
    messages.push({
      role: 'system',
      content: `短期记忆:\n${input.shortMemory}`,
    });
  }

  if (input.includeHistorySummary) {
    const summary = summarizeHistory(input.history);
    if (summary) {
      messages.push({ role: 'system', content: summary.summary });
    }
  }

  const userMessage: ContextMessage = { role: 'user', content: input.task.input };
  const usedByFixed = builder.countMessagesTokens([...messages, userMessage]);
  const maxTokens = builder.getMaxTokens();
  const availableTokens = Math.max(0, maxTokens - usedByFixed);
  const selectedHistory = builder.trimToFit(input.history, availableTokens);
  messages.push(...selectedHistory);
  messages.push(userMessage);

  const usedTokens = builder.countMessagesTokens(messages);

  return {
    messages,
    tokenBudget: {
      maxTokens,
      reservedTokens: usedByFixed,
      availableTokens,
      usedTokens,
    },
  };
};
