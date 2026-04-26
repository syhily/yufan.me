import { describe, expect, it } from 'vite-plus/test'

import { formatLocalDate, formatShowDate, slicePosts } from '@/shared/formatter'

describe('services/markdown/formatter — slicePosts', () => {
  it('returns the requested page slice and the correct totalPage count', () => {
    const posts = Array.from({ length: 23 }, (_, i) => i)
    const result = slicePosts(posts, 2, 10)
    expect(result.totalPage).toBe(3)
    expect(result.currentPosts).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  })

  it('returns the trailing tail (not a fixed-size window) on the last page', () => {
    const posts = Array.from({ length: 23 }, (_, i) => i)
    const result = slicePosts(posts, 3, 10)
    expect(result.currentPosts).toEqual([20, 21, 22])
  })

  it('returns an empty slice but keeps totalPage when overflowing', () => {
    expect(slicePosts([1, 2, 3], 5, 2)).toEqual({ currentPosts: [], totalPage: 2 })
  })

  it('returns totalPage=0 for an empty list', () => {
    expect(slicePosts([], 1, 10)).toEqual({ currentPosts: [], totalPage: 0 })
  })
})

describe('services/markdown/formatter — date formatting', () => {
  it('formatShowDate returns 今天 for the current calendar day', () => {
    expect(formatShowDate(new Date())).toBe('今天')
  })

  it('formatShowDate returns 昨天 for one day before now', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(formatShowDate(yesterday)).toBe('昨天')
  })

  it("formatShowDate returns 'N 天前' inside the past week", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(formatShowDate(threeDaysAgo)).toMatch(/^[1-6] 天前$/)
  })

  it('formatLocalDate honours an explicit format string', () => {
    const date = new Date('2024-05-15T12:34:56.000Z')
    expect(formatLocalDate(date, 'yyyy-LL-dd')).toBe('2024-05-15')
  })
})
