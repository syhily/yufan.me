import config from '@/blog.config'

interface LocalDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const localDateFormatter = new Intl.DateTimeFormat(config.settings.locale, {
  timeZone: config.settings.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function localDateParts(source: Date): LocalDateParts {
  const parts = Object.fromEntries(
    localDateFormatter
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

export function formatShowDate(date: Date) {
  const source = localDateParts(date)
  const now = localDateParts(new Date())
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
    return formatLocalDate(date)
  }
}

export function formatLocalDate(source: string | Date, format?: string) {
  const date = new Date(source)
  const parts = localDateParts(date)
  return (format || config.settings.timeFormat)
    .replaceAll('yyyy', String(parts.year))
    .replaceAll('LL', pad(parts.month))
    .replaceAll('MM', pad(parts.month))
    .replaceAll('dd', pad(parts.day))
    .replaceAll('HH', pad(parts.hour))
    .replaceAll('mm', pad(parts.minute))
}
