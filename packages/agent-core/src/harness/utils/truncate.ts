import { Buffer } from 'node:buffer';

export interface TruncateOptions {
  maxLines?: number;
  maxBytes?: number;
  suffix?: string;
}

const DEFAULT_SUFFIX = '\n[输出已截断]';

export function truncateByBytes(text: string, maxBytes: number, suffix = DEFAULT_SUFFIX): string {
  if (maxBytes <= 0) {
    return '';
  }

  const total = Buffer.byteLength(text, 'utf8');
  if (total <= maxBytes) {
    return text;
  }

  const suffixBytes = Buffer.byteLength(suffix, 'utf8');
  const target = Math.max(0, maxBytes - suffixBytes);

  let left = 0;
  let right = text.length;
  while (left < right) {
    const mid = (left + right + 1) >>> 1;
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= target) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return `${text.slice(0, left)}${suffix}`;
}

export function truncateByLines(text: string, maxLines: number, suffix = DEFAULT_SUFFIX): string {
  if (maxLines <= 0) {
    return '';
  }

  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text;
  }

  const kept = lines.slice(0, maxLines).join('\n');
  const dropped = lines.length - maxLines;
  return `${kept}\n[输出已截断，省略 ${dropped} 行]`;
}

export function truncateOutput(
  text: string,
  options: TruncateOptions = {},
  suffix = DEFAULT_SUFFIX,
): string {
  let result = text;
  if (options.maxLines !== undefined) {
    result = truncateByLines(result, options.maxLines, suffix);
  }
  if (options.maxBytes !== undefined) {
    result = truncateByBytes(result, options.maxBytes, suffix);
  }
  return result;
}
