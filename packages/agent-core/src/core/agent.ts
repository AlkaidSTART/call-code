import { callLLM } from './llm';
import { systemPrompt } from '../prompt/system';
import { toolPrompt } from '../prompt/tool';
import { listFilesTool as toolList } from '../tools';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export const agent = async (input: string) => {
  const messages: Message[] = [
    {
      role: 'system',
      content: systemPrompt + '\n' + toolPrompt,
    },
    {
      role: 'user',
      content: input,
    },
  ];
  const tools = [toolList];
  const toolPromptMessages = [
    {
      role: 'system',
      content: toolPrompt,
    },
  ];
};
