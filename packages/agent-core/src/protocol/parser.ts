import { isAgentAction, isFinalAction, isToolCallAction, type AgentAction } from '@protocol/action';

export const parseAgentResponse = (response: string): AgentAction | null => {
  try {
    const parsed = JSON.parse(response) as unknown;
    return isAgentAction(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const shouldContinueLoop = (response: string): boolean => {
  const parsed = parseAgentResponse(response);
  if (parsed && isToolCallAction(parsed)) {
    return true;
  }
  if (parsed && isFinalAction(parsed)) {
    return false;
  }

  const normalized = response.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const solvedSignals = ['已完成', '完成', '已解决', '解决了', 'done', 'finished'];
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

export const extractFinalText = (response: string): string => {
  const parsed = parseAgentResponse(response);
  if (parsed && isFinalAction(parsed)) {
    return parsed.message;
  }
  if (parsed && parsed.message.trim()) {
    return parsed.message;
  }
  try {
    const fallback = JSON.parse(response) as { message?: unknown };
    if (typeof fallback.message === 'string' && fallback.message.trim()) {
      return fallback.message;
    }
  } catch {
    // keep raw response for non-JSON fallback
  }
  return response;
};
