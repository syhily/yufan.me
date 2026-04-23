// Lightweight structured JSON logger. We deliberately don't pull in pino/winston
// to keep the runtime footprint small — the SSR adapter only needs leveled,
// structured output to stdout/stderr. A future refactor can swap this for a
// real implementation by changing `emit()` only.
//
// Privacy: known L3 fields (e.g. email, ip, name) are wrapped in {E}…{/E}
// markers per `.cursor/rules/privacy-logging.mdc`, so log aggregators can
// strip or hash them before storage. Callers don't need to remember to tag
// values manually — using the standard key names is enough.

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function isLevel(value: string | undefined): value is Level {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
}

function readMinLevel(): Level {
  const fallback = import.meta.env.PROD ? 'info' : 'debug'
  if (typeof process === 'undefined') return fallback
  return isLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : fallback
}

const minLevel: Level = readMinLevel()

// Field names that hold L3 (direct identifier) data. Values logged under
// these keys are wrapped in `{E}…{/E}` markers in the emitted JSON string.
const L3_KEYS = new Set([
  'email',
  'ip',
  'clientAddress',
  'remoteAddress',
  'userAgent',
  'phone',
  'name',
  'authorEmail',
  'authorIp',
  'cookie',
  'deviceId',
])

function tagL3(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value === '' ? value : `{E}${value}{/E}`
  // For numbers/objects/arrays, coerce to string so the marker still applies.
  return `{E}${String(value)}{/E}`
}

function applyPrivacyTags(context: LogContext): LogContext {
  const tagged: LogContext = {}
  for (const [key, value] of Object.entries(context)) {
    tagged[key] = L3_KEYS.has(key) ? tagL3(value) : value
  }
  return tagged
}

interface LogContext {
  [key: string]: unknown
}

function emit(level: Level, scope: string, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

  const safeContext = context ? applyPrivacyTags(context) : undefined

  const payload = {
    level,
    scope,
    msg: message,
    time: new Date().toISOString(),
    ...safeContext,
  }

  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  // Stringify so log aggregators can parse it; fall back to console.log if
  // stringify fails (e.g. circular ref).
  try {
    target(JSON.stringify(payload))
  } catch {
    target(`[${level}] ${scope} ${message}`, safeContext ?? {})
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
