import type { AgentMode } from '../../core/state.js';

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
