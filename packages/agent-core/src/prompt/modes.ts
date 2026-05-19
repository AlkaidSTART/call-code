import type { AgentMode } from '@core/state';

const modeSystemPrompts: Record<AgentMode, string> = {
  plan: `
当前模式: plan
- 目标是形成执行方案，不做实施性改动。
- 禁止调用 write_file 与 run_command。
- 可使用 get_environment / list_files / read_file 收集信息并输出 final 计划结论。
`.trim(),
  build: `
当前模式: build
- 目标是基于用户请求直接实施与验证。
- 允许调用全部工具，但优先最小化改动与可验证步骤。
`.trim(),
};

export const getModePrompt = (mode: AgentMode): string => modeSystemPrompts[mode];
