import type { AgentMode } from '@core/state';

const modeSystemPrompts: Record<AgentMode, string> = {
  plan: `
当前模式: plan
- 目标是形成执行方案，不做实施性改动。
- 禁止调用任何工具，不得创建/修改任何文件，不得执行任何命令。
- 直接输出 final 计划结论（纯文本）。
`.trim(),
  build: `
当前模式: build
- 目标是基于用户请求直接实施与验证。
- 允许调用全部工具，但优先最小化改动与可验证步骤。
`.trim(),
};

export const getModePrompt = (mode: AgentMode): string => modeSystemPrompts[mode];
