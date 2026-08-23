import type { AgentMode } from '@agent-core/harness/core/state';

export interface ModePolicy {
  readonly allowBash: boolean;
  readonly allowWriteFile: boolean;
}

export const modePolicies: Record<AgentMode, ModePolicy> = {
  plan: {
    allowBash: false,
    allowWriteFile: false,
  },
  build: {
    allowBash: true,
    allowWriteFile: true,
  },
};
