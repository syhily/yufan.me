import { describe, expect, it } from 'vite-plus/test'

import { API_ACTIONS } from '@/client/api/actions'
import { loader as calendarLoader } from '@/routes/image.calendar'
import { notFound, pngResponse } from '@/server/route-helpers/http'
import { listingSeo } from '@/server/route-helpers/listing-seo'
import { parsePageNum, redirectListingOverflow } from '@/server/route-helpers/pagination'
import { canonicalPostPath, searchRootPath } from '@/server/route-helpers/paths'
import { commentAwareRevalidate } from '@/server/route-helpers/revalidate'
import { slicePosts } from '@/shared/formatter'

describe('route shared helpers', () => {
  it('pngResponse sets image/png and preserves extra headers', async () => {
    const response = pngResponse(new Uint8Array([1, 2, 3]), {
      'Cache-Control': 'public, max-age=60',
    })

    expect(response.headers.get('Content-Type')).toContain('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3])
  })

  it('notFound throws a 404 Response', () => {
    try {
      notFound()
      throw new Error('expected notFound to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      expect((error as Response).status).toBe(404)
    }
  })

  it('calendar image route rejects invalid calendar dates with 404', async () => {
    await expect(
      calendarLoader({
        params: { year: '2026', time: '0230' },
        request: new Request('http://localhost/images/calendar/2026/0230.png'),
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('canonicalPostPath redirects aliases to the canonical post URL', () => {
    expect(canonicalPostPath('old-slug', 'new-slug')).toBe('/posts/new-slug')
    expect(canonicalPostPath('new-slug', 'new-slug')).toBeUndefined()
  })
})

describe('listing SEO helpers', () => {
  it('parsePageNum rejects partial numeric strings with 404', () => {
    expect(() => parsePageNum('2abc')).toThrow(Response)
  })

  it('slicePosts keeps the real total page count on overflow', () => {
    expect(slicePosts([1, 2, 3], 3, 2)).toEqual({ currentPosts: [], totalPage: 2 })
  })

  it('redirectListingOverflow redirects overflowing page routes to the last page', () => {
    try {
      redirectListingOverflow('3', 3, 2, '/cats/test')
      throw new Error('expected redirectListingOverflow to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/cats/test/page/2')
    }
  })

  it('redirectListingOverflow keeps empty listings as 404', () => {
    try {
      redirectListingOverflow('2', 2, 0, '/cats/empty')
      throw new Error('expected redirectListingOverflow to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      expect((error as Response).status).toBe(404)
    }
  })

  it('listingSeo builds canonical paging links and supports forced noindex', () => {
    const meta = listingSeo({
      title: '搜索结果',
      pageNum: 2,
      totalPage: 3,
      rootPath: '/search/example',
      forceNoindex: true,
    })
    const titleTag = meta.find((tag) => 'title' in tag)
    expect(titleTag).toEqual({ title: expect.stringContaining('搜索结果 · 第 2 页') })
    const canonical = meta.find((tag) => 'tagName' in tag && tag.tagName === 'link' && tag.rel === 'canonical')
    expect(canonical).toMatchObject({ href: expect.stringContaining('/search/example/page/2') })
    const prev = meta.find((tag) => 'tagName' in tag && tag.tagName === 'link' && tag.rel === 'prev')
    expect(prev).toMatchObject({ href: expect.stringContaining('/search/example') })
    const next = meta.find((tag) => 'tagName' in tag && tag.tagName === 'link' && tag.rel === 'next')
    expect(next).toMatchObject({ href: expect.stringContaining('/search/example/page/3') })
    const robots = meta.find((tag) => 'name' in tag && tag.name === 'robots')
    expect(robots).toEqual({ name: 'robots', content: 'noindex,follow' })
  })

  it('searchRootPath percent-encodes the path segment used for canonical links', () => {
    expect(searchRootPath('hello world/中文')).toBe('/search/hello%20world%2F%E4%B8%AD%E6%96%87')
  })
})

describe('route revalidation helpers', () => {
  it("keeps React Router's default behavior for plain link navigations", () => {
    expect(
      commentAwareRevalidate({
        formAction: undefined,
        defaultShouldRevalidate: true,
      } as never),
    ).toBe(true)
    expect(
      commentAwareRevalidate({
        formAction: undefined,
        defaultShouldRevalidate: false,
      } as never),
    ).toBe(false)
  })

  it('skips comment-action revalidation for listing and detail routes', () => {
    const args = {
      formAction: API_ACTIONS.comment.replyComment.path,
      defaultShouldRevalidate: true,
    } as never

    expect(commentAwareRevalidate(args)).toBe(false)
  })

  it('keeps non-comment submissions on the default path', () => {
    expect(
      commentAwareRevalidate({
        formAction: API_ACTIONS.auth.updateUser.path,
        defaultShouldRevalidate: true,
      } as never),
    ).toBe(true)
  })
})
