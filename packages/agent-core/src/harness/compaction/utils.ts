import type { ContextMessage } from '../session/context/context-types';
import type { EntryLike } from '../session/sessionInfo/session-repository';

/** 摘要阶段累积的文件读写信息，后续追加到摘要里让模型保留文件上下文。 */
export interface FileOperations {
  read: Set<string>;
  written: Set<string>;
  edited: Set<string>;
}

export const createFileOps = (): FileOperations => ({
  read: new Set<string>(),
  written: new Set<string>(),
  edited: new Set<string>(),
});

const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? 'undefined';
  } catch {
    return '[unserializable]';
  }
};

const safeParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const getPathValue = (target: Record<string, unknown>): string | undefined => {
  const argsValue = target.arguments;
  const args =
    argsValue && typeof argsValue === 'object'
      ? (argsValue as Record<string, unknown>)
      : typeof argsValue === 'string'
        ? (safeParseJson(argsValue) as Record<string, unknown> | undefined)
        : undefined;

  const pathValue =
    args && typeof args.path === 'string'
      ? args.path
      : typeof target.path === 'string'
        ? target.path
        : typeof target.requestedPath === 'string'
          ? target.requestedPath
          : undefined;

  return pathValue;
};

/**
 * 从 assistant 协议 JSON 或工具结果 JSON 中提取路径。
 * 当前上下文没有结构化 tool call，只能靠内容里的 JSON 字段还原。
 */
export const extractFileOpsFromContent = (
  content: string,
  fileOps: FileOperations,
  toolName?: string,
): void => {
  if (!content.startsWith('{') && !content.startsWith('[')) {
    return;
  }

  const parsed = safeParseJson(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }

  const target = parsed as Record<string, unknown>;
  const resolvedTool =
    typeof target.tool === 'string' ? target.tool : toolName ?? '';
  const pathValue = getPathValue(target);
  if (!pathValue) {
    return;
  }

  const normalizedTool = resolvedTool.toLowerCase();
  if (
    normalizedTool === 'read_file' ||
    normalizedTool === 'read' ||
    normalizedTool === 'search' ||
    normalizedTool === 'git_diff' ||
    resolvedTool === 'read_file'
  ) {
    fileOps.read.add(pathValue);
    return;
  }
  if (normalizedTool === 'write_file' || normalizedTool === 'write') {
    fileOps.written.add(pathValue);
    return;
  }
  if (normalizedTool === 'edit') {
    fileOps.edited.add(pathValue);
    return;
  }
  if (typeof target.content === 'string' && target.content.includes('requestedPath')) {
    fileOps.read.add(pathValue);
  }
};

export const extractFileOpsFromMessage = (
  message: ContextMessage,
  fileOps: FileOperations,
): void => {
  extractFileOpsFromContent(message.content, fileOps);
};

export const extractFileOpsFromEntry = (
  entry: EntryLike,
  fileOps: FileOperations,
): void => {
  if (!entry.payload || typeof entry.payload !== 'object') {
    return;
  }
  const payload = entry.payload as Record<string, unknown>;
  if (typeof payload.content === 'string') {
    const toolName = typeof payload.tool === 'string' ? payload.tool : undefined;
    extractFileOpsFromContent(payload.content, fileOps, toolName);
  }
};

export const computeFileLists = (fileOps: FileOperations): {
  readFiles: string[];
  modifiedFiles: string[];
} => {
  const modified = new Set([...fileOps.edited, ...fileOps.written]);
  const readFiles = [...fileOps.read].filter((file) => !modified.has(file)).sort();
  const modifiedFiles = [...modified].sort();
  return { readFiles, modifiedFiles };
};

export const formatFileOperations = (
  readFiles: string[],
  modifiedFiles: string[],
): string => {
  const sections: string[] = [];
  if (readFiles.length > 0) {
    sections.push(`<read-files>\n${readFiles.join('\n')}\n</read-files>`);
  }
  if (modifiedFiles.length > 0) {
    sections.push(`<modified-files>\n${modifiedFiles.join('\n')}\n</modified-files>`);
  }
  if (sections.length === 0) {
    return '';
  }
  return `\n\n${sections.join('\n\n')}`;
};

const TOOL_RESULT_MAX_CHARS = 2000;

export const truncateForSummary = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) {
    return text;
  }
  const truncatedChars = text.length - maxChars;
  return `${text.slice(0, maxChars)}\n\n[... ${truncatedChars} more characters truncated]`;
};

export const estimateTokens = (message: ContextMessage): number => {
  const chars = message.content?.length ?? 0;
  return Math.ceil(chars / 4) + 4;
};

export const estimateContextTokens = (messages: ContextMessage[]): number =>
  messages.reduce((total, message) => total + estimateTokens(message), 0) + 2;

const serializedAssistantContent = (content: string): string => {
  const parsed = safeParseJson(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return content;
  }

  const target = parsed as Record<string, unknown>;
  if (target.type !== 'tool_call' || typeof target.tool !== 'string') {
    return content;
  }

  const args = target.arguments;
  const argsText =
    args && typeof args === 'object'
      ? Object.entries(args as Record<string, unknown>)
          .map(([key, value]) => `${key}=${safeJsonStringify(value)}`)
          .join(', ')
      : safeJsonStringify(args);
  return `tool_call ${target.tool}(${argsText})`;
};

/** 把当前 ContextMessage 序列化成适合摘要 prompt 的纯文本。 */
export const serializeConversation = (messages: ContextMessage[]): string =>
  messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Assistant' : 'User';
      const text =
        message.role === 'assistant'
          ? serializedAssistantContent(message.content)
          : message.content;
      return `[${role}]: ${truncateForSummary(text, TOOL_RESULT_MAX_CHARS)}`;
    })
    .join('\n\n');
