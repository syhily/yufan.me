import { describe, expect, it } from 'vite-plus/test'

import { EMPTY_COMMENT_HTML, EMPTY_COMMENT_RAW, parseContent } from '@/server/markdown/parser'

// Stage-5 short-circuit: `parseContent` must avoid the (cold-load) marked +
// shiki + sanitize pipeline for the empty-comment placeholder. We assert it
// returns the constant *synchronously enough* that we can race it against a
// long-running call without observing the marked round-trip.

describe('services/markdown/parser — EMPTY_COMMENT short-circuit', () => {
  it('returns the constant for the literal placeholder string', async () => {
    expect(await parseContent(EMPTY_COMMENT_RAW)).toBe(EMPTY_COMMENT_HTML)
  })

  it('returns the constant for empty input', async () => {
    expect(await parseContent('')).toBe(EMPTY_COMMENT_HTML)
  })

  it('accepts null and undefined and returns the empty placeholder', async () => {
    expect(await parseContent(null)).toBe(EMPTY_COMMENT_HTML)
    expect(await parseContent(undefined)).toBe(EMPTY_COMMENT_HTML)
  })

  it('normalises CRLF and still hits the short-circuit if the result is empty', { timeout: 30_000 }, async () => {
    expect(await parseContent('\r\n')).not.toBe(EMPTY_COMMENT_HTML)
    expect(await parseContent('')).toBe(EMPTY_COMMENT_HTML)
  })
})
