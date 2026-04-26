import { describe, expect, it } from 'vite-plus/test'

import { parseContent } from '@/server/markdown/parser'

// Snapshot a handful of canonical markdown shapes (heading, link, code
// fence, blockquote) so any change in the marked + shiki + ultrahtml
// pipeline surfaces as a PR diff. The first snapshot also exercises the
// shiki cold-load — bump the timeout accordingly.

describe('snapshot: markdown parser HTML output', () => {
  it('renders a heading + paragraph + bold/em sequence', { timeout: 30_000 }, async () => {
    const html = await parseContent('# Hello\n\nThis is **bold** and *em*.')
    expect(html).toMatchSnapshot()
  })

  it('renders a fenced code block via shiki', async () => {
    const html = await parseContent('```ts\nconst x: number = 1;\n```')
    expect(html).toMatchSnapshot()
  })

  it('renders blockquote + nested list', async () => {
    const html = await parseContent('> note:\n>\n> - one\n> - two\n>   - nested\n')
    expect(html).toMatchSnapshot()
  })

  it('normalises external link attributes', async () => {
    const html = await parseContent('[gh](https://github.com/example)')
    expect(html).toMatchSnapshot()
  })
})
