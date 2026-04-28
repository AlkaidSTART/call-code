import { callLLM } from './llm.ts';
const res = await callLLM([
  {
    role: 'system',
    content: '你是一个专业的法律助手',
  },
  {
    role: 'user',
    content: '你好',
  },
]);
