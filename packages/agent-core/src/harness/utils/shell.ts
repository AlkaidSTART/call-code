import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { truncateOutput, type TruncateOptions } from '@agent-core/harness/utils/truncate';
const execFileAsync = promisify(execFile);

export interface ExecShellOptions {
  command: string;
  cwd?: string;
  maxBufferBytes?: number;
  maxOutputLines?: number;
  maxOutputBytes?: number;
  shell?: string;
  shellFlag?: string;
}

export interface ExecShellResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export const execShell = async (
  options: ExecShellOptions,
): Promise<ExecShellResult> => {
  const {
    command,
    cwd,
    maxBufferBytes = 10 * 1024 * 1024,
    maxOutputLines,
    maxOutputBytes,
    shell = process.env.SHELL || 'bash',
    shellFlag = '-lc',
  } = options;

  if (!command || typeof command !== 'string' || !command.trim()) {
    throw new Error('Invalid command');
  }

  const { stdout, stderr } = await execFileAsync(shell, [shellFlag, command], {
    maxBuffer: maxBufferBytes,
    cwd,
  });

  return buildResult({ command, cwd, stdout, stderr }, {
    maxOutputLines,
    maxOutputBytes,
  });
};

interface ShellLimits {
  maxOutputLines?: number;
  maxOutputBytes?: number;
}

const buildResult = (
  raw: { command: string; cwd?: string; stdout: string; stderr: string },
  limits: ShellLimits,
): ExecShellResult => {
  const wouldTruncate = (value: string): boolean => {
    if (limits.maxOutputLines !== undefined && value.split('\n').length > limits.maxOutputLines) {
      return true;
    }
    if (limits.maxOutputBytes !== undefined && Buffer.byteLength(value, 'utf8') > limits.maxOutputBytes) {
      return true;
    }
    return false;
  };

  const truncated = wouldTruncate(raw.stdout) || wouldTruncate(raw.stderr);
  const options: TruncateOptions = {};
  if (limits.maxOutputLines !== undefined) {
    options.maxLines = limits.maxOutputLines;
  }
  if (limits.maxOutputBytes !== undefined) {
    options.maxBytes = limits.maxOutputBytes;
  }
  const stdout = truncateOutput(raw.stdout, options);
  const stderr = truncateOutput(raw.stderr, options);

  return {
    command: raw.command,
    cwd: raw.cwd || process.cwd(),
    exitCode: 0,
    stdout,
    stderr,
    truncated,
  };
};
