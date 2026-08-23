type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const write = (level: LogLevel, ...args: unknown[]): void => {
  const method =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.debug;
  method(...args);
};

export const logger = {
  debug: (...args: unknown[]): void => write('debug', ...args),
  info: (...args: unknown[]): void => write('info', ...args),
  warn: (...args: unknown[]): void => write('warn', ...args),
  error: (...args: unknown[]): void => write('error', ...args),
};
