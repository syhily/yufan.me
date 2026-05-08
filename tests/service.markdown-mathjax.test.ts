import type { Root } from 'hast'

import { toHtml } from 'hast-util-to-html'
import { VFile } from 'vfile'
import { describe, expect, it } from 'vite-plus/test'

import rehypeMathjax from '@/server/markdown/rehype-mathjax'

describe('services/markdown/rehype-mathjax', () => {
  it('emits the SVG global font cache used by rendered formulas', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [
            { type: 'text', value: 'math ' },
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['math-inline'] },
              children: [{ type: 'text', value: 'a+b' }],
            },
          ],
        },
      ],
    }

    rehypeMathjax({ svg: { fontCache: 'global' } })(tree, new VFile())

    const html = toHtml(tree)
    expect(html).toContain('id="MJX-SVG-global-cache"')
    expect(html).toContain('<defs>')
    expect(html).toContain('id="MJX-TEX-I-1D44E"')
    expect(html).toContain('xlink:href="#MJX-TEX-I-1D44E"')
  })

  it('renders math inside MDX JSX component children', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'mdxJsxFlowElement',
          name: 'Solution',
          attributes: [],
          children: [
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [
                { type: 'text', value: 'inside ' },
                {
                  type: 'element',
                  tagName: 'code',
                  properties: { className: ['language-math', 'math-inline'] },
                  children: [{ type: 'text', value: 'a+b' }],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as Root

    rehypeMathjax({ svg: { fontCache: 'global' } })(tree, new VFile())

    const serialized = JSON.stringify(tree)
    expect(serialized).toContain('mjx-container')
    expect(serialized).toContain('MJX-SVG-global-cache')
    expect(serialized).not.toContain('language-math')
  })
})
