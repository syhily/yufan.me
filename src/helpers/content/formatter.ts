import { DateTime } from 'luxon'
import config from '@/blog.config'

export function slicePosts<Type>(posts: Type[], pageNum: number, pageSize: number): { currentPosts: Type[], totalPage: number } {
  const totalPage = Math.ceil(posts.length / pageSize)
  if (totalPage >= pageNum) {
    return {
      currentPosts:
        pageNum === totalPage
          ? posts.slice((pageNum - 1) * pageSize)
          : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
      totalPage,
    }
  }
  return { currentPosts: [], totalPage: 0 }
}

export function formatShowDate(date: Date) {
  const source = DateTime.fromJSDate(date)
    .setZone(config.settings.timeZone)
    .setLocale(config.settings.locale)

  const now = DateTime.now()
    .setZone(config.settings.timeZone)
    .setLocale(config.settings.locale)

  const oneSeconds = 1000
  const oneMinute = oneSeconds * 60
  const oneHour = oneMinute * 60
  const oneDay = oneHour * 24
  const oneWeek = oneDay * 7
  const oneMonth = oneDay * 30

  const delta = now.startOf('day').diff(source.startOf('day')).toMillis()

  if (delta < oneDay) {
    return '今天'
  }
  else if (delta < oneDay * 2) {
    return '昨天'
  }
  else if (delta < oneWeek) {
    return `${Math.floor(delta / oneDay)} 天前`
  }
  else if (delta < oneMonth) {
    return `${Math.floor(now.startOf('week').diff(source.startOf('week')).toMillis() / oneWeek)} 周前`
  }
  else if (delta < oneMonth * 7) {
    const { months } = now.startOf('month').diff(source.startOf('month'), ['months']).toObject()
    return `${months} 月前`
  }
  else {
    // Format the post's date with time zone support.
    return source.toFormat(config.settings.timeFormat)
  }
}

export function formatLocalDate(source: string | Date, format?: string) {
  const date = new Date(source)
  return DateTime.fromJSDate(date)
    .setZone(config.settings.timeZone)
    .setLocale(config.settings.locale)
    .toFormat(format || config.settings.timeFormat)
}
