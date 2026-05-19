export interface AgentResponse {
  type: 'tool_call' | 'final' | string;
  tool: string | null;
  arguments: Record<string, unknown> | null;
  message: string;
}

export const parseAgentResponse = (response: string): AgentResponse | null => {
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

export const shouldContinueLoop = (response: string): boolean => {
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
  if (parsed?.type === 'final') {
    return typeof parsed.message === 'string' ? parsed.message : '';
  }
  if (parsed) {
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
    return '';
  }
  return response;
};
