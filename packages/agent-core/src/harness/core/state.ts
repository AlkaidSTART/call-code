import { randomUUID } from 'node:crypto';

export type AgentMode = 'plan' | 'build';

export interface TaskState {
  id: string;
  input: string;
  mode: AgentMode;
  objective: string;
  constraints: string[];
  workspace?: string;
  createdAt: string;
}

export interface CreateTaskStateOptions {
  mode?: AgentMode;
  objective?: string;
  constraints?: string[];
  workspace?: string;
}

const normalizeConstraints = (constraints?: string[]): string[] => {
  if (!constraints?.length) {
    return [];
  }

  return constraints
    .map((item) => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
};

export const createTaskState = (
  input: string,
  options: CreateTaskStateOptions = {},
): TaskState => {
  const trimmedInput = input.trim();

  return {
    id: randomUUID(),
    input,
    mode: options.mode ?? 'build',
    objective: options.objective?.trim() || trimmedInput || '完成用户请求',
    constraints: normalizeConstraints(options.constraints),
    workspace: options.workspace,
    createdAt: new Date().toISOString(),
  };
};
