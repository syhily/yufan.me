import { describe, expect, it } from 'vite-plus/test'

import type { PortableTextBody } from '@/shared/portable-text'

import { PortableTextBody as PortableTextBodyComponent } from '@/ui/portable-text/PortableTextBody'

import { renderInRouter, stableHtml } from './_helpers/render'

// Snapshot-style assertions for the SSR PortableText renderer. The
// renderer is exercised top-to-bottom for each block type so a future
// change that quietly drops a node — e.g. removing the `<figure>`
// wrapper around image blocks, breaking the math `{__html}` payload,
// or losing the footnote section — fails this contract instead of
// silently shipping degraded markup.

describe('PortableTextBody SSR renderer', () => {
  it('renders standard text blocks with anchor ids on headings', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'h1',
        style: 'h2',
        children: [{ _type: 'span', _key: 's1', text: '我的标题' }],
      },
      {
        _type: 'block',
        _key: 'p1',
        style: 'normal',
        children: [
          { _type: 'span', _key: 's2', text: 'Hello ', marks: undefined },
          { _type: 'span', _key: 's3', text: 'world', marks: ['strong'] },
        ],
      },
    ]
    const html = stableHtml(renderInRouter(<PortableTextBodyComponent body={body} />))
    expect(html).toContain('<h2 id="')
    expect(html).toContain('我的标题</h2>')
    expect(html).toContain('<p>Hello <strong>world</strong></p>')
  })

  it('renders custom blocks with the right wrappers', () => {
    const body: PortableTextBody = [
      {
        _type: 'image',
        _key: 'img1',
        src: 'https://example.com/x.jpg',
        alt: 'demo',
        caption: 'caption text',
      },
      {
        _type: 'code',
        _key: 'code1',
        code: 'console.log(1)',
        language: 'js',
      },
      {
        _type: 'mathBlock',
        _key: 'math1',
        tex: 'a^2 + b^2 = c^2',
      },
      {
        _type: 'mermaid',
        _key: 'm1',
        code: 'graph TD\n  A --> B',
      },
      { _type: 'horizontalRule', _key: 'hr1' },
    ]
    const html = stableHtml(renderInRouter(<PortableTextBodyComponent body={body} />))
    expect(html).toContain('<figure>')
    expect(html).toContain('<figcaption>caption text</figcaption>')
    expect(html).toMatch(/class="[^"]*math-display[^"]*"/)
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('<hr/>')
  })

  it('renders footnote definitions in a single trailing section', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'p1',
        style: 'normal',
        children: [
          {
            _type: 'span',
            _key: 's1',
            text: 'See note',
            marks: ['fnref'],
          },
        ],
        markDefs: [
          {
            _type: 'footnoteRef',
            _key: 'fnref',
            targetKey: 'fn1',
            index: 1,
          },
        ],
      },
      {
        _type: 'footnoteDefinition',
        _key: 'fn1',
        index: 1,
        children: [
          {
            _type: 'block',
            _key: 'fn1p',
            style: 'normal',
            children: [{ _type: 'span', _key: 'fns', text: '脚注内容' }],
          },
        ],
      },
    ]
    const html = stableHtml(renderInRouter(<PortableTextBodyComponent body={body} />))
    // Reference inline.
    expect(html).toContain('id="user-content-fnref-1"')
    expect(html).toContain('href="#user-content-fn-1"')
    // Definition section appended at the end.
    expect(html).toContain('class="footnotes"')
    expect(html).toContain('id="user-content-fn-1"')
    expect(html).toContain('脚注内容')
  })
})
