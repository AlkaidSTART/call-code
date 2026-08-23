import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { truncateByBytes, truncateByLines, truncateOutput } from '@utils/truncate';
import { execShell } from '@utils/shell';

describe('truncate', () => {
  it('truncates by line count and reports dropped lines', () => {
    expect(truncateByLines('a\nb\nc', 2)).toBe('a\nb\n[输出已截断，省略 1 行]');
  });

  it('keeps text unchanged when within limits', () => {
    expect(truncateByLines('a\nb', 5)).toBe('a\nb');
    expect(truncateByLines('', 5)).toBe('');
  });

  it('returns empty when maxLines is zero or negative', () => {
    expect(truncateByLines('a\nb', 0)).toBe('');
    expect(truncateByLines('a\nb', -1)).toBe('');
  });

  it('truncates by bytes without splitting multibyte characters', () => {
    const text = '中文内容测试，long tail here';
    const maxBytes = 24;
    const result = truncateByBytes(text, maxBytes);
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(maxBytes);
    expect(result.endsWith('[输出已截断]')).toBe(true);
  });

  it('does not split multibyte characters at the cut point', () => {
    const text = '中文内容测试，这是一段更长的中文内容用于字节截断测试';
    const result = truncateByBytes(text, 21);
    expect(result).toContain('[输出已截断]');
    expect(Buffer.byteLength(text, 'utf8')).toBeGreaterThan(
      Buffer.byteLength(result.slice(0, result.indexOf('[输出已截断]')), 'utf8'),
    );
  });

  it('keeps text unchanged when within byte budget', () => {
    const text = 'hello';
    expect(truncateByBytes(text, 100)).toBe(text);
    expect(truncateByBytes('', 100)).toBe('');
  });

  it('returns empty when maxBytes is zero or negative', () => {
    expect(truncateByBytes('hello', 0)).toBe('');
    expect(truncateByBytes('hello', -5)).toBe('');
  });

  it('applies lines then bytes in order via truncateOutput', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line-${i}`).join('\n');
    const result = truncateOutput(lines, { maxLines: 3, maxBytes: 1000 });
    expect(result.split('\n').length).toBe(4);
    expect(result).toContain('[输出已截断');
  });
});

describe('execShell', () => {
  it('runs a command and returns output', async () => {
    const result = await execShell({ command: 'printf hello' });
    expect(result.stdout).toBe('hello');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.cwd).toBe(process.cwd());
  });

  it('throws on empty command', async () => {
    await expect(execShell({ command: '   ' })).rejects.toThrow('Invalid command');
  });

  it('truncates long output by lines', async () => {
    const command = 'printf "a\\nb\\nc\\n"';
    const result = await execShell({ command, maxOutputLines: 2 });
    expect(result.truncated).toBe(true);
    expect(result.stdout).toContain('[输出已截断');
  });

  it('respects custom working directory', async () => {
    const cwd = await import('node:fs/promises').then((fs) =>
      fs.mkdtemp(path.join(os.tmpdir(), 'agent-shell-')),
    );
    try {
      const result = await execShell({ command: 'pwd', cwd });
      const real = await import('node:fs/promises').then((fs) => fs.realpath(cwd));
      expect(result.stdout.trim()).toBe(real);
      expect(result.cwd).toBe(cwd);
    } finally {
      await import('node:fs/promises').then((fs) => fs.rm(cwd, { recursive: true, force: true }));
    }
  });
});
