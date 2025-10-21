import type { Post } from '@/helpers/content/schema'
import { DateTime } from 'luxon'
import config from '@/blog.config'

export function slicePosts(posts: Post[], pageNum: number, pageSize: number): { currentPosts: Post[], totalPage: number } {
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

  if (source.year === now.year && source.month === now.month && source.day === now.day) {
    return '今天'
  }

  const delta = now.diff(source, ['years', 'months', 'weeks', 'days'])
  if (delta.get('years') < 1) {
    if (delta.get('months') === 0 && delta.get('weeks') === 0 && delta.get('days') < 7) {
      return `${Math.floor(delta.get('days')) + 1} 天前`
    }
    if (delta.get('months') <= 1 && delta.get('weeks') <= 5) {
      return `${Math.floor(delta.get('weeks')) + 1} 周前`
    }
    if (delta.get('months') < 5) {
      return `${Math.floor(delta.get('months')) + 1} 月前`
    }
  }

  // Format the post's date with time zone support.
  return source.toFormat(config.settings.timeFormat)
}

export function formatLocalDate(source: string | Date, format?: string) {
  const date = new Date(source)
  return DateTime.fromJSDate(date)
    .setZone(config.settings.timeZone)
    .setLocale(config.settings.locale)
    .toFormat(format || config.settings.timeFormat)
}
