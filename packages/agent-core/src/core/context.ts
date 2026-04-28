export class ContextBuilder {
  constructor(private maxTokens = 8000) {}

  build({ system, history, input, summary }) {
    let messages = [];

    // system
    messages.push({ role: 'system', content: system });

    // summary（长期记忆）
    if (summary) {
      messages.push({ role: 'system', content: summary });
    }

    // recent（短期记忆）
    const recent = this.trimToFit(history);

    messages.push(...recent);

    // 当前输入
    messages.push({ role: 'user', content: input });

    return messages;
  }

  trimToFit(history) {
    // TODO: token裁剪逻辑
    return history.slice(-10);
  }
}
