import type { AgentMode } from '@core/state';

export interface ModePolicy {
  readonly allowRunCommand: boolean;
  readonly allowWriteFile: boolean;
}

export const modePolicies: Record<AgentMode, ModePolicy> = {
  plan: {
    allowRunCommand: false,
    allowWriteFile: false,
  },
  build: {
    allowRunCommand: true,
    allowWriteFile: true,
  },
};
