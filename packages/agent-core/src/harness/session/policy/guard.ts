import type { AgentMode } from '@agent-core/harness/core/state';
import { modePolicies } from './modes';

const toolPermissionByName = (toolName: string, mode: AgentMode): boolean => {
  const policy = modePolicies[mode];
  if (mode === 'plan') {
    return false;
  }
  if (toolName === 'bash') {
    return policy.allowBash;
  }
  if (toolName === 'write_file') {
    return policy.allowWriteFile;
  }
  return true;
};

export const enforceToolPermission = (
  mode: AgentMode,
  toolName: string,
): { ok: true } | { ok: false; error: string } => {
  if (toolPermissionByName(toolName, mode)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Tool "${toolName}" is not allowed in mode "${mode}"`,
  };
};
