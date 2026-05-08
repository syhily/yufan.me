import { describe, expect, it } from 'vite-plus/test'

import type { PortableTextBody } from '@/shared/portable-text'

import { bodyToPmDoc, pmDocToBody } from '@/shared/pt-bridge'

// PortableText ↔ ProseMirror bridge contract tests. The on-disk PT is
// the canonical shape (validated by the API perimeter); ProseMirror is
// runtime-only. The contract is therefore one-sided:
//
//   - `bodyToPmDoc(body)` MUST produce a doc Tiptap will accept.
//   - `pmDocToBody(bodyToPmDoc(body))` MUST round-trip the standard
//     subset *equivalently* (same shape modulo span keys, which the
//     bridge regenerates because PM's text nodes don't carry `_key`).
//
// We explicitly relax span keys because the bridge cannot recover the
// original `_key` of a text run after it's been chunked + remarked by
// ProseMirror's internal model. Block-level `_key` IS preserved end to
// end and is asserted here.

function stripSpanKeys(body: PortableTextBody): PortableTextBody {
  return body.map((block) => {
    if (block._type !== 'block') {
      return block
    }
    return {
      ...block,
      children: block.children.map((span) => ({ ...span, _key: 's' })),
    }
  })
}

describe('contract: pt-bridge — empty body', () => {
  it('emits a single empty paragraph so ProseMirror accepts the doc', () => {
    const doc = bodyToPmDoc([])
    expect(doc.content.length).toBe(1)
    expect(doc.content[0].type).toBe('paragraph')
  })
})

describe('contract: pt-bridge — round-trip on the standard subset', () => {
  it('round-trips paragraphs with decorator marks', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        children: [
          { _type: 'span', _key: 's1', text: 'plain ' },
          { _type: 'span', _key: 's2', text: 'bold', marks: ['strong'] },
          { _type: 'span', _key: 's3', text: ' & ' },
          { _type: 'span', _key: 's4', text: 'italic', marks: ['em'] },
        ],
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(stripSpanKeys(back)).toEqual(stripSpanKeys(body))
  })

  it('round-trips h1-h4 headings preserving the block-level _key', () => {
    const body: PortableTextBody = [
      { _type: 'block', _key: 'h-one', style: 'h1', children: [{ _type: 'span', _key: 's1', text: '一' }] },
      { _type: 'block', _key: 'h-two', style: 'h2', children: [{ _type: 'span', _key: 's2', text: '二' }] },
      { _type: 'block', _key: 'h-three', style: 'h3', children: [{ _type: 'span', _key: 's3', text: '三' }] },
      { _type: 'block', _key: 'h-four', style: 'h4', children: [{ _type: 'span', _key: 's4', text: '四' }] },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back.map((b) => b._key)).toEqual(['h-one', 'h-two', 'h-three', 'h-four'])
    expect(stripSpanKeys(back)).toEqual(stripSpanKeys(body))
  })

  it('round-trips blockquotes', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'q1',
        style: 'blockquote',
        children: [{ _type: 'span', _key: 's1', text: 'quoted' }],
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back[0]._type).toBe('block')
    expect(back[0]).toMatchObject({ style: 'blockquote' })
  })

  it('round-trips bullet lists and ordered lists, folding consecutive items', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'li1',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        children: [{ _type: 'span', _key: 's1', text: 'a' }],
      },
      {
        _type: 'block',
        _key: 'li2',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        children: [{ _type: 'span', _key: 's2', text: 'b' }],
      },
      {
        _type: 'block',
        _key: 'li3',
        style: 'normal',
        listItem: 'number',
        level: 1,
        children: [{ _type: 'span', _key: 's3', text: '1' }],
      },
    ]
    const doc = bodyToPmDoc(body)
    expect(doc.content.map((c) => c.type)).toEqual(['bulletList', 'orderedList'])
    const back = pmDocToBody(doc)
    expect(back.map((b) => ({ listItem: b._type === 'block' ? b.listItem : null }))).toEqual([
      { listItem: 'bullet' },
      { listItem: 'bullet' },
      { listItem: 'number' },
    ])
  })

  it('round-trips link marks via markDefs', () => {
    const body: PortableTextBody = [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        markDefs: [{ _type: 'link', _key: 'l1', href: 'https://example.com', rel: 'noreferrer', target: '_blank' }],
        children: [
          { _type: 'span', _key: 's1', text: 'click ' },
          { _type: 'span', _key: 's2', text: 'here', marks: ['l1'] },
        ],
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back[0]).toMatchObject({
      _type: 'block',
      markDefs: [{ _type: 'link', href: 'https://example.com', rel: 'noreferrer', target: '_blank' }],
    })
    expect(back[0]._type === 'block' && back[0].children[1].marks?.length).toBe(1)
  })

  it('round-trips images preserving every attribute slot the schema accepts', () => {
    const body: PortableTextBody = [
      {
        _type: 'image',
        _key: 'img-1',
        src: 'https://cdn/example.jpg',
        alt: 'cover',
        caption: '一行说明',
        width: 1280,
        height: 720,
        thumbhash: 'tt',
        storagePath: 'images/2026/05/example.jpg',
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back).toEqual(body)
  })

  it('round-trips fenced code blocks preserving language and content', () => {
    const body: PortableTextBody = [
      {
        _type: 'code',
        _key: 'c-1',
        code: 'const x = 1\nconsole.log(x)',
        language: 'ts',
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back).toEqual(body)
  })

  it('round-trips horizontal rules', () => {
    const body: PortableTextBody = [{ _type: 'horizontalRule', _key: 'hr-1' }]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back).toEqual(body)
  })
})

describe('contract: pt-bridge — custom blocks pass through opaquely', () => {
  it('musicPlayer blocks round-trip via the blockCard payload slot', () => {
    const body: PortableTextBody = [{ _type: 'musicPlayer', _key: 'mp-1', playerId: 'abcdef0123456789', auto: true }]
    const doc = bodyToPmDoc(body)
    expect(doc.content[0].type).toBe('blockCard')
    const back = pmDocToBody(doc)
    expect(back).toEqual(body)
  })

  it('mathBlock and mermaid round-trip identically', () => {
    const body: PortableTextBody = [
      { _type: 'mathBlock', _key: 'mb-1', tex: 'E=mc^2' },
      { _type: 'mermaid', _key: 'mr-1', code: 'graph TD;A-->B;' },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back).toEqual(body)
  })

  it('solution blocks round-trip with their nested children intact', () => {
    const body: PortableTextBody = [
      {
        _type: 'solution',
        _key: 'sol-1',
        children: [
          {
            _type: 'block',
            _key: 'sol-1-b1',
            style: 'normal',
            children: [{ _type: 'span', _key: 'sol-1-s1', text: 'inner' }],
          },
        ],
      },
    ]
    const back = pmDocToBody(bodyToPmDoc(body))
    expect(back).toEqual(body)
  })
})
