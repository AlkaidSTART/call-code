import { callLLM } from '@core/llm';
import { systemPrompt } from '@prompt/systemPrompt';
import { toolPrompt } from '@prompt/toolPrompt';
import { tools } from '@tools';
import { run } from 'node:test';
import { runLoop } from '@core/loop';

export const agent = async (input: string) => {
  const res = await runLoop(input);
};
