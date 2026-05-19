import { get_encoding, type Tiktoken } from 'tiktoken';
import type { ContextMessage } from '@agent-core/context/context-types';

export class ContextBuilder {
  private readonly encoder: Tiktoken;

  constructor(private readonly maxTokens = 8000) {
    this.encoder = get_encoding('cl100k_base');
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

  getMaxTokens(): number {
    return this.maxTokens;
  }
}
