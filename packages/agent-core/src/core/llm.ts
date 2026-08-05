import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
dotenv.config({ path: '.env.local' });

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamHandlers {
  onStart?: () => void;
  onDelta?: (delta: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: unknown) => void;
  onTrace?: (message: string) => void;
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

export const llmModel = process.env.OPENAI_MODEL ?? '';

const missingModelMessage =
  '你没有配置 OPENAI_MODEL，请在 .env 或 .env.local 中设置模型名称。';

export async function callLLM(messages: Message[]) {
  if (!llmModel) {
    throw new Error(missingModelMessage);
  }

  const res = await client.chat.completions.create({
    model: llmModel,
    messages,
    temperature: 0,
  });

  return res.choices[0].message.content;
}

export async function streamLLM(
  messages: Message[],
  handlers: StreamHandlers = {},
) {
  handlers.onStart?.();

  try {
    if (!llmModel) {
      throw new Error(missingModelMessage);
    }

    const stream = await client.chat.completions.create({
      model: llmModel,
      messages,
      temperature: 0,
      stream: true,
    });

    let content = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) {
        continue;
      }

      content += delta;
      handlers.onDelta?.(delta);
    }

    handlers.onComplete?.(content);
    return content;
  } catch (error) {
    handlers.onError?.(error);
    throw error;
  }
}
