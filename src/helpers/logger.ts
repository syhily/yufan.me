// Lightweight structured JSON logger. We deliberately don't pull in pino/winston
// to keep the runtime footprint small — the SSR adapter only needs leveled,
// structured output to stdout/stderr. A future refactor can swap this for a
// real implementation by changing `emit()` only.

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? (import.meta.env.PROD ? 'info' : 'debug')

interface LogContext {
  [key: string]: unknown
}

function emit(level: Level, scope: string, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

  const payload = {
    level,
    scope,
    msg: message,
    time: new Date().toISOString(),
    ...context,
  }

  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  // Stringify so log aggregators can parse it; fall back to console.log if
  // stringify fails (e.g. circular ref).
  try {
    target(JSON.stringify(payload))
  } catch {
    target(`[${level}] ${scope} ${message}`, context ?? {})
  }
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  child(extra: LogContext): Logger
  withScope(scope: string): Logger
}

function makeLogger(scope: string, base: LogContext = {}): Logger {
  const merge = (extra?: LogContext): LogContext => ({ ...base, ...extra })
  return {
    debug: (msg, ctx) => emit('debug', scope, msg, merge(ctx)),
    info: (msg, ctx) => emit('info', scope, msg, merge(ctx)),
    warn: (msg, ctx) => emit('warn', scope, msg, merge(ctx)),
    error: (msg, ctx) => emit('error', scope, msg, merge(ctx)),
    child: (extra) => makeLogger(scope, { ...base, ...extra }),
    withScope: (newScope) => makeLogger(newScope, base),
  }
}

export const logger: Logger = makeLogger('app')

export function getLogger(scope: string): Logger {
  return logger.withScope(scope)
}
