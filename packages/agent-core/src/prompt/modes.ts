export type AgentMode = 'default' | 'strict';

export interface ModePolicy {
  readonly allowRunCommand: boolean;
  readonly requireEnvironmentProbeForWorkspacePaths: boolean;
}

export const modePolicies: Record<AgentMode, ModePolicy> = {
  default: {
    allowRunCommand: true,
    requireEnvironmentProbeForWorkspacePaths: true,
  },
  strict: {
    allowRunCommand: true,
    requireEnvironmentProbeForWorkspacePaths: true,
  },
};
