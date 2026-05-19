export type MessageRole = 'system' | 'user' | 'assistant';

export interface ContextMessage {
  role: MessageRole;
  content: string;
}

export interface RuntimeContext {
  messages: ContextMessage[];
  tokenBudget: {
    maxTokens: number;
    reservedTokens: number;
    availableTokens: number;
    usedTokens: number;
  };
}
