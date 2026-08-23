export interface ToolResultObservation {
  type: 'tool_result';
  tool: string | null;
  ok: boolean;
  result: unknown;
  error: string | null;
}

export const createToolResultObservation = (input: {
  tool: string | null;
  ok: boolean;
  result?: unknown;
  error?: string;
}): ToolResultObservation => ({
  type: 'tool_result',
  tool: input.tool,
  ok: input.ok,
  result: input.ok ? (input.result ?? null) : null,
  error: input.ok ? null : (input.error ?? 'Unknown error'),
});
