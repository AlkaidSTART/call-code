import { callLLM } from './llm';
import { systemPrompt } from '../prompt/system';
import { toolPrompt } from '../prompt/tool';
import { listFilesTool as toolList } from '../tools';
import { run } from 'node:test';
import { runLoop } from './loop';

export const agent = async (input: string) => {
  const res = await runLoop(input);
};
