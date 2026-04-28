import { callLLM } from '@core/llm';

async function main() {
  const res = await callLLM([
    {
      role: 'user',
      content: '随便返回一个JSON，比如 {"msg":"hello"}',
    },
  ]);

  console.log('LLM返回：', res);
}

main();
