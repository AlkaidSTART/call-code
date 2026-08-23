export interface ToolCallAction {
  type: 'tool_call';
  tool: string;
  arguments: Record<string, unknown>;
  message: string;
}

export interface FinalAction {
  type: 'final';
  tool: null;
  arguments: null;
  message: string;
}

export type AgentAction = ToolCallAction | FinalAction;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBaseActionShape = (
  value: unknown,
): value is {
  type: unknown;
  tool: unknown;
  arguments: unknown;
  message: unknown;
} => isRecord(value) && 'type' in value && 'tool' in value && 'arguments' in value && 'message' in value;

export const isToolCallAction = (value: unknown): value is ToolCallAction => {
  if (!isBaseActionShape(value)) {
    return false;
  }

  return (
    value.type === 'tool_call' &&
    typeof value.tool === 'string' &&
    value.tool.trim().length > 0 &&
    isRecord(value.arguments) &&
    typeof value.message === 'string'
  );
};

export const isFinalAction = (value: unknown): value is FinalAction => {
  if (!isBaseActionShape(value)) {
    return false;
  }

  return (
    value.type === 'final' &&
    value.tool === null &&
    value.arguments === null &&
    typeof value.message === 'string'
  );
};

export const isAgentAction = (value: unknown): value is AgentAction =>
  isToolCallAction(value) || isFinalAction(value);
