import { OpenAI } from 'openai';

//定义消息类型
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
//创建OpenAI客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
//基础调用函数
export async function callLLM(messages: Message[]) {
  const res = await client.chat.completions.create({
    model: 'deepseek-v4-pro',
    messages,
    temperature: 0,
  });

  return res.choices[0].message.content;
}
