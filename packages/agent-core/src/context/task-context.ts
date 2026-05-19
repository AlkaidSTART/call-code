import type { TaskState } from '@core/state';

export interface TaskContext {
  id: string;
  mode: TaskState['mode'];
  objective: string;
  constraints: string[];
  workspace: string | null;
  createdAt: string;
}

export const createTaskContext = (task: TaskState): TaskContext => ({
  id: task.id,
  mode: task.mode,
  objective: task.objective,
  constraints: [...task.constraints],
  workspace: task.workspace ?? null,
  createdAt: task.createdAt,
});
