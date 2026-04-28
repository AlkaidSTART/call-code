import { callLLM } from '@core/llm';
import { listFilesTool } from '@tools';
import { systemPrompt } from '@prompt/systemPrompt';
import { toolPrompt } from '@prompt/toolPrompt';
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export const runLoop = async (input: string) => {
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: input,
    },
  ];
  let step = 0;
  while (true) {
    if (step++ < 10) {
      break;
      return '超出循环次数限制';
    } else {
      const res = await callLLM(messages);
      messages.push({
        role: 'assistant',
        content: res!,
      });
      console.log('LLM回复：', res!);
    }
  }
};
