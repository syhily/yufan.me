import { describe, expect, it } from 'vite-plus/test'

import { API_ACTION_LIST, API_ACTIONS } from '@/client/api/actions'
import { ErrorMessages } from '@/server/route-helpers/errors'
import { commentAwareRevalidate, isCommentAction } from '@/server/route-helpers/revalidate'
import { safeHref, safeRedirectPath } from '@/shared/safe-url'
import { groupBy, isNumeric, sampleSize, shuffle } from '@/shared/tools'
import { joinUrl, withLeadingSlash } from '@/shared/urls'

// Pure utility coverage. These functions get composed into hot loaders and
// have no infrastructure dependencies, so they're cheap to test exhaustively.

describe('shared/tools — isNumeric', () => {
  it('accepts integer-looking strings (with optional leading minus)', () => {
    expect(isNumeric('0')).toBe(true)
    expect(isNumeric('-42')).toBe(true)
    expect(isNumeric('12345')).toBe(true)
  })

  it('rejects floats, alphas, blanks, and trailing junk', () => {
    expect(isNumeric('')).toBe(false)
    expect(isNumeric('12.0')).toBe(false)
    expect(isNumeric('12abc')).toBe(false)
    expect(isNumeric('--1')).toBe(false)
    expect(isNumeric(' 12')).toBe(false)
  })
})

describe('shared/tools — shuffle / sampleSize', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('shuffle without seed returns a permutation (same multiset)', () => {
    const result = shuffle(items)
    expect(result).not.toBe(items)
    expect(result.length).toBe(items.length)
    expect([...result].sort((a, b) => a - b)).toEqual(items)
  })

  it('shuffle with the same seed is deterministic', () => {
    const a = shuffle(items, 'deterministic-seed')
    const b = shuffle(items, 'deterministic-seed')
    expect(a).toEqual(b)
  })

  it('shuffle with different seeds produces different orders for non-trivial inputs', () => {
    const a = shuffle(items, 'seed-a')
    const b = shuffle(items, 'seed-b')
    expect(a).not.toEqual(b)
  })

  it('sampleSize returns at most n items, all distinct, drawn from the input', () => {
    const sample = sampleSize(items, 3, 'seed')
    expect(sample.length).toBe(3)
    expect(new Set(sample).size).toBe(3)
    for (const x of sample) expect(items).toContain(x)
  })

  it('sampleSize handles edge cases (n<=0, n>=length, empty input)', () => {
    expect(sampleSize(items, 0)).toEqual([])
    expect(sampleSize([], 5)).toEqual([])
    const all = sampleSize(items, 100, 'seed')
    expect(all.length).toBe(items.length)
  })
})

describe('shared/tools — groupBy', () => {
  it('buckets items by key function output', () => {
    const grouped = groupBy([1, 2, 3, 4, 5, 6], (n) => (n % 2 === 0 ? 'even' : 'odd'))
    expect(grouped).toEqual({ even: [2, 4, 6], odd: [1, 3, 5] })
  })

  it('returns an empty object for empty input', () => {
    expect(groupBy<number, 'x'>([], () => 'x')).toEqual({})
  })
})

describe('shared/urls', () => {
  it('joinUrl preserves the protocol and collapses interior slashes', () => {
    expect(joinUrl('https://yufan.me/', '/posts/', 'hello/')).toBe('https://yufan.me/posts/hello/')
  })

  it('joinUrl skips empty segments instead of duplicating slashes', () => {
    expect(joinUrl('https://yufan.me', '', '/posts', '')).toBe('https://yufan.me/posts')
  })

  it('withLeadingSlash is idempotent', () => {
    expect(withLeadingSlash('/foo')).toBe('/foo')
    expect(withLeadingSlash('foo')).toBe('/foo')
  })

  it('joinUrl returns empty string when every part is empty', () => {
    expect(joinUrl('', '', '')).toBe('')
  })
})

describe('shared/safe-url', () => {
  it('keeps only http(s) hrefs', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a')
    expect(safeHref(' http://example.com ')).toBe('http://example.com')
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('mailto:test@example.com')).toBeUndefined()
    expect(safeHref('')).toBeUndefined()
  })

  it('keeps redirect targets on the same origin and returns path/search/hash', () => {
    expect(safeRedirectPath('/wp-admin?tab=1#top', '/', 'https://yufan.me')).toBe('/wp-admin?tab=1#top')
    expect(safeRedirectPath('https://yufan.me/posts/hello', '/', 'https://yufan.me/wp-login.php')).toBe('/posts/hello')
  })

  it('falls back for external, protocol-relative, and invalid redirect targets', () => {
    expect(safeRedirectPath('https://evil.example/a', '/', 'https://yufan.me')).toBe('/')
    expect(safeRedirectPath('//evil.example/a', '/', 'https://yufan.me')).toBe('/')
    expect(safeRedirectPath('javascript:alert(1)', '/wp-admin', 'https://yufan.me')).toBe('/wp-admin')
    expect(safeRedirectPath('', '/wp-admin', 'https://yufan.me')).toBe('/wp-admin')
  })
})

describe('shared/api-actions', () => {
  it('every action keeps `path` aligned with its `route`', () => {
    for (const action of API_ACTION_LIST) {
      expect(action.path).toBe(`/${action.route}`)
      expect(action.route.startsWith('api/actions/')).toBe(true)
    }
  })

  it('auth/comment grouping is exhaustively listed in API_ACTION_LIST', () => {
    const flat = [...Object.values(API_ACTIONS.auth), ...Object.values(API_ACTIONS.comment)]
    expect(new Set(flat).size).toBe(flat.length)
    expect(flat.length).toBe(API_ACTION_LIST.length)
  })

  it('PII-bearing endpoints are POST (validateLikeToken/findAvatar/loadAll)', () => {
    expect(API_ACTIONS.comment.validateLikeToken.method).toBe('POST')
    expect(API_ACTIONS.comment.findAvatar.method).toBe('POST')
    expect(API_ACTIONS.comment.loadAll.method).toBe('POST')
  })

  it('read-only endpoints stay GET (loadComments / getRaw / getFilterOptions)', () => {
    expect(API_ACTIONS.comment.loadComments.method).toBe('GET')
    expect(API_ACTIONS.comment.getRaw.method).toBe('GET')
    expect(API_ACTIONS.comment.getFilterOptions.method).toBe('GET')
  })
})

describe('routes/_shared/revalidate', () => {
  it('recognizes comment action URLs in relative, absolute, and query-string forms', () => {
    expect(isCommentAction(API_ACTIONS.comment.replyComment.path)).toBe(true)
    expect(isCommentAction(`https://yufan.me${API_ACTIONS.comment.replyComment.path}?from=reply`)).toBe(true)
    expect(isCommentAction(API_ACTIONS.auth.updateUser.path)).toBe(false)
  })

  it('skips detail-route revalidation after comment submissions only', () => {
    expect(
      commentAwareRevalidate({
        formAction: API_ACTIONS.comment.replyComment.path,
        defaultShouldRevalidate: true,
      } as never),
    ).toBe(false)
    expect(
      commentAwareRevalidate({
        formAction: API_ACTIONS.auth.updateUser.path,
        defaultShouldRevalidate: true,
      } as never),
    ).toBe(true)
  })
})

describe('routes/_shared/errors — ErrorMessages', () => {
  it('exposes the canonical admin error message used by requireAdminSession', () => {
    expect(ErrorMessages.NOT_ADMIN).toBe('当前用户不是管理员。')
  })

  it('never re-uses the same message for two different errors (helps log triage)', () => {
    const values = Object.values(ErrorMessages)
    expect(new Set(values).size).toBe(values.length)
  })
})
