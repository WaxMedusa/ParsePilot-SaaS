import { appConfig } from './env';

/**
 * Structured JSON logging. Document contents and secrets are never logged:
 * known sensitive keys are redacted recursively, and callers only pass
 * identifiers, counts, timings and error categories.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'stripe_secret',
  'text',
  'documenttext',
  'content',
  'rawtext',
  'prompt',
  'email',
  'address',
];

function shouldLog(level: LogLevel): boolean {
  const configured = (appConfig.logLevel || 'info') as LogLevel;
  return LEVEL_WEIGHT[level] >= (LEVEL_WEIGHT[configured] ?? 20);
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 30).map((entry) => redact(entry, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().replace(/[^a-z_]/g, '').includes(sensitive))) {
        out[key] = '[redacted]';
      } else {
        out[key] = redact(entry, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  if (!shouldLog(level)) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    service: 'parsepilot-web',
    message,
    ...(redact(context) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
  child(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext) => emit('debug', message, { ...base, ...context }),
      info: (message: string, context?: LogContext) => emit('info', message, { ...base, ...context }),
      warn: (message: string, context?: LogContext) => emit('warn', message, { ...base, ...context }),
      error: (message: string, context?: LogContext) => emit('error', message, { ...base, ...context }),
    };
  },
};

/** Categorises failures for retry policy and dashboards. */
export function categorizeError(error: unknown): 'transient' | 'permanent' | 'provider' | 'timeout' | 'quota' {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) return 'timeout';
  if (/quota|rate limit|429/i.test(message)) return 'quota';
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up|503|502|504/i.test(message)) return 'transient';
  if (/unsupported|invalid|corrupt|password|validation|400|422/i.test(message)) return 'permanent';
  return 'provider';
}
