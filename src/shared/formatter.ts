// Date formatter primitives shared between SSR and the client bundle.
//
// The `Intl.DateTimeFormat` instance can no longer be cached at module
// scope because the locale / time zone come from the runtime DB-backed
// blog config — the value an admin picks in `/wp-admin/settings/localization`
// must take effect on the next render without restarting the server.
//
// Callers thread the relevant slice of the config in explicitly:
//
// ```ts
// // SSR / server callers
// import { requireBlogConfig } from '@/shared/blog-config-snapshot'
// formatLocalDate(post.date, undefined, requireBlogConfig())
// // UI components
// const localization = useLocalization()
// formatShowDate(post.date, localization)
// ```
//
// Either a `LocalizationSettings` (flat) or a legacy `BlogConfig`
// (`config.settings.locale / timeZone / timeFormat`) is accepted. The
// flat shape is preferred for new code so the caller pulls only the
// section it actually needs.

export type FormatterLocale =
  | { locale: string; timeZone: string; timeFormat: string }
  | { settings: { locale: string; timeZone: string; timeFormat: string } }

function pickLocale(config: FormatterLocale): { locale: string; timeZone: string; timeFormat: string } {
  if ('settings' in config) return config.settings
  return config
}

interface LocalDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function makeFormatter(locale: string, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

// Tiny LRU keyed by `${locale}|${timeZone}` so repeated formatter calls
// for the same deployment do not pay the `Intl.DateTimeFormat` ctor
// cost on every invocation. The cap is generous enough for any real
// deployment; admin-side experimentation that flips locales rapidly is
// the only realistic source of churn.
const formatterCache = new Map<string, Intl.DateTimeFormat>()
const FORMATTER_CACHE_MAX = 8

function cachedFormatter(locale: string, timeZone: string): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}`
  const existing = formatterCache.get(key)
  if (existing !== undefined) return existing

  const formatter = makeFormatter(locale, timeZone)
  if (formatterCache.size >= FORMATTER_CACHE_MAX) {
    const oldest = formatterCache.keys().next().value
    if (oldest !== undefined) formatterCache.delete(oldest)
  }
  formatterCache.set(key, formatter)
  return formatter
}

function localDateParts(source: Date, locale: string, timeZone: string): LocalDateParts {
  const formatter = cachedFormatter(locale, timeZone)
  const parts = Object.fromEntries(
    formatter
      .formatToParts(source)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  }
}

function dayNumber(parts: Pick<LocalDateParts, 'year' | 'month' | 'day'>): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000)
}

function weekStartDay(parts: Pick<LocalDateParts, 'year' | 'month' | 'day'>): number {
  const day = dayNumber(parts)
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  return day - ((weekday + 6) % 7)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function slicePosts<Type>(
  posts: Type[],
  pageNum: number,
  pageSize: number,
): { currentPosts: Type[]; totalPage: number } {
  const totalPage = Math.ceil(posts.length / pageSize)
  if (totalPage === 0 || pageNum > totalPage) {
    return { currentPosts: [], totalPage }
  }

  return {
    currentPosts:
      pageNum === totalPage
        ? posts.slice((pageNum - 1) * pageSize)
        : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    totalPage,
  }
}

export function formatShowDate(date: Date, config: FormatterLocale) {
  const { locale, timeZone } = pickLocale(config)
  const source = localDateParts(date, locale, timeZone)
  const now = localDateParts(new Date(), locale, timeZone)
  const deltaDays = dayNumber(now) - dayNumber(source)

  if (deltaDays < 1) {
    return '今天'
  } else if (deltaDays < 2) {
    return '昨天'
  } else if (deltaDays < 7) {
    return `${deltaDays} 天前`
  } else if (deltaDays < 30) {
    return `${Math.floor((weekStartDay(now) - weekStartDay(source)) / 7)} 周前`
  } else if (deltaDays < 210) {
    const months = (now.year - source.year) * 12 + now.month - source.month
    return `${months} 月前`
  } else {
    return formatLocalDate(date, undefined, config)
  }
}

export function formatLocalDate(source: string | Date, format: string | undefined, config: FormatterLocale): string {
  const { locale, timeZone, timeFormat } = pickLocale(config)
  const date = new Date(source)
  const parts = localDateParts(date, locale, timeZone)
  return (format || timeFormat)
    .replaceAll('yyyy', String(parts.year))
    .replaceAll('LL', pad(parts.month))
    .replaceAll('MM', pad(parts.month))
    .replaceAll('dd', pad(parts.day))
    .replaceAll('HH', pad(parts.hour))
    .replaceAll('mm', pad(parts.minute))
}
