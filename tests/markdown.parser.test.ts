import { describe, expect, it } from 'vite-plus/test'

import { parseContent } from '@/server/markdown/parser'

// Safety net for the comment markdown pipeline. `parseContent` runs on
// untrusted user input (comments) and on category descriptions, so any
// regression that leaks <script>, javascript: URLs, or strips the
// `target="_blank" rel="nofollow"` markers on external links would be a
// security or SEO concern.
// Parser cold-load (unified + remark + shiki) routinely exceeds vitest's
// default 5s budget on the first call; subsequent assertions run against the
// warmed pipeline and are fast.
describe('services/markdown/parser', () => {
  it('does not emit live <script> tags from user content', { timeout: 30_000 }, async () => {
    const html = await parseContent('hello <script>alert(1)</script> world')
    expect(html.toLowerCase()).not.toContain('<script')
    // CommonMark treats unknown tags as text; the payload may remain as plain
    // characters inside `<p>` — the XSS surface is the absent active tag.
    expect(html).toContain('hello')
    expect(html).toContain('world')
  })

  it('marks external links as target=_blank with nofollow', async () => {
    const html = await parseContent('[external](https://example.com)')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="nofollow"')
  })

  it('does not add target=_blank to internal links', async () => {
    const html = await parseContent('[home](https://yufan.me/about)')
    expect(html).toContain('href="https://yufan.me/about"')
    expect(html).not.toContain('target="_blank"')
  })

  it('returns the same rendered HTML on repeated calls (LRU hit)', async () => {
    const a = await parseContent('# cache me')
    const b = await parseContent('# cache me')
    expect(b).toBe(a)
  })

  it('preserves GFM unchecked task list inputs (type/disabled survive prune)', async () => {
    const html = await parseContent('- [ ] todo')
    expect(html).toMatch(/<input[^>]*type="checkbox"/)
    expect(html).toMatch(/<input[^>]*disabled/)
    expect(html).not.toMatch(/<input[^>]*checked/)
  })

  it('preserves GFM checked task list inputs (checked attribute survives)', async () => {
    const html = await parseContent('- [x] done')
    expect(html).toMatch(/<input[^>]*type="checkbox"/)
    expect(html).toMatch(/<input[^>]*checked/)
  })
})
