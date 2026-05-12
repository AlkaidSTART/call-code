import { get_encoding, type Tiktoken } from 'tiktoken';

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BuildContextInput {
  system: string;
  history: ContextMessage[];
  input: string;
  summary?: string;
}

export class ContextBuilder {
  private readonly encoder: Tiktoken;

  constructor(private readonly maxTokens = 8000) {
    this.encoder = get_encoding('cl100k_base');
  }

  build({
    system,
    history,
    input,
    summary,
  }: BuildContextInput): ContextMessage[] {
    const messages: ContextMessage[] = [{ role: 'system', content: system }];

    if (summary) {
      messages.push({ role: 'system', content: summary });
    }

    const userMessage: ContextMessage = { role: 'user', content: input };
    const budget = Math.max(
      0,
      this.maxTokens - this.countMessagesTokens([...messages, userMessage]),
    );

    messages.push(...this.trimToFit(history, budget));
    messages.push(userMessage);

    return messages;
  }

  countTokens(text: string): number {
    return this.encoder.encode_ordinary(text).length;
  }

  countMessageTokens(message: ContextMessage): number {
    return this.countTokens(message.content) + 4;
  }

  countMessagesTokens(messages: ContextMessage[]): number {
    return (
      messages.reduce(
        (total, message) => total + this.countMessageTokens(message),
        0,
      ) + 2
    );
  }

  trimToFit(history: ContextMessage[], maxTokens: number): ContextMessage[] {
    const selected: ContextMessage[] = [];
    let remaining = maxTokens;

    for (let index = history.length - 1; index >= 0; index--) {
      const message = history[index];
      const messageTokens = this.countMessageTokens(message);

      if (messageTokens > remaining) {
        continue;
      }

      selected.unshift(message);
      remaining -= messageTokens;
    }

    return selected;
  }

  free() {
    this.encoder.free();
  }
}
