type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LOG_COLORS: Record<LogLevel, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
};

const RESET = '\x1b[0m';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): void {
  const color = LOG_COLORS[level];
  const prefix = `${color}[${formatTimestamp()}] [${level.toUpperCase()}] [${context}]${RESET}`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  
  if (level === 'error') {
    console.error(`${prefix} ${message}${dataStr}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}${dataStr}`);
  } else {
    console.log(`${prefix} ${message}${dataStr}`);
  }
}

export const logger = {
  info: (context: string, message: string, data?: Record<string, unknown>) => log('info', context, message, data),
  warn: (context: string, message: string, data?: Record<string, unknown>) => log('warn', context, message, data),
  error: (context: string, message: string, data?: Record<string, unknown>) => log('error', context, message, data),
  debug: (context: string, message: string, data?: Record<string, unknown>) => log('debug', context, message, data),
};
