import { describe, expect, it } from 'vite-plus/test'

import type { Block, ImageBlock, MusicPlayerBlock, TextBlock } from '@/shared/portable-text'

import { convertMdxBodyToPortableText } from '@/server/cms/pages/migrate-mdx'
import { validatePortableTextBody } from '@/shared/portable-text'

// Unit tests for the MDX → PortableText converter that powers the
// one-shot `scripts/migrate-mdx-pages.mjs` runner. The converter is
// intentionally narrow (handles only the constructs the small static-
// page corpus uses), so the tests focus on:
//
//   1. Each supported mdast construct projects to the expected PT
//      block / span shape.
//   2. The output round-trips through `validatePortableTextBody` so a
//      future schema tightening fails the migration loudly instead of
//      silently producing an unrenderable revision.
//   3. The `<MusicPlayer>` JSX-shaped HTML matches the editor's PT
//      block contract (`musicPlayer.playerId`). `<Friends />` is
//      explicitly NOT a converter feature — the friends grid is a
//      meta toggle (`page.show_friends`) rendered outside the body,
//      and the migration script strips the JSX tag from the source
//      before the converter runs. The "rejects unsupported HTML"
//      test below pins the contract.
//   4. Image lookup is delegated to a caller-supplied resolver: a hit
//      writes `storagePath` + `width` + `height` + `thumbhash`, a
//      miss surfaces in `unresolvedImages` and leaves the block with
//      the bare URL.

const noResolveImages = async (_src: string) => null

function findOne<T extends Block>(blocks: readonly Block[], type: T['_type']): T {
  const match = blocks.find((b): b is T => b._type === type)
  if (match === undefined) {
    throw new Error(`No block of type '${type}' in body`)
  }
  return match
}

describe('convertMdxBodyToPortableText', () => {
  it('projects a paragraph with bold / italic / link / inlineCode into one text block', async () => {
    const md = ['Hello **bold** and *italic* and `code` and [link](https://example.com).'].join('\n')
    const { body } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    const block = findOne<TextBlock>(body, 'block')
    const texts = block.children.map((s) => s.text).join('|')
    expect(texts).toContain('Hello ')
    expect(texts).toContain('bold')
    expect(texts).toContain('italic')
    expect(texts).toContain('code')
    expect(texts).toContain('link')

    const boldSpan = block.children.find((s) => s.text === 'bold')
    expect(boldSpan?.marks).toEqual(['strong'])

    const italicSpan = block.children.find((s) => s.text === 'italic')
    expect(italicSpan?.marks).toEqual(['em'])

    const codeSpan = block.children.find((s) => s.text === 'code')
    expect(codeSpan?.marks).toEqual(['code'])

    const linkDef = block.markDefs?.find((d) => d._type === 'link')
    expect(linkDef?.href).toBe('https://example.com')

    const linkSpan = block.children.find((s) => s.text === 'link')
    expect(linkSpan?.marks).toEqual([linkDef?._key])

    expect(() => validatePortableTextBody(body)).not.toThrow()
  })

  it('promotes a paragraph whose only visible child is an image to a standalone image block (no resolver hit)', async () => {
    const md = '![Alt text](https://cat.example.com/foo.jpg "Caption")'
    const { body, unresolvedImages } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    expect(body).toHaveLength(1)
    const image = findOne<ImageBlock>(body, 'image')
    expect(image.src).toBe('https://cat.example.com/foo.jpg')
    expect(image.alt).toBe('Alt text')
    expect(image.caption).toBe('Caption')
    expect(image.storagePath).toBeUndefined()
    expect(image.width).toBeUndefined()
    expect(unresolvedImages).toEqual(['https://cat.example.com/foo.jpg'])
  })

  it('writes storagePath + dimensions when the resolver returns a hit', async () => {
    const md = '![Alt](https://cat.example.com/foo.jpg)'
    const { body, unresolvedImages } = await convertMdxBodyToPortableText(md, {
      resolveImageBySrc: async (src) => {
        if (src === 'https://cat.example.com/foo.jpg') {
          return {
            storagePath: 'images/2026/05/foo.jpg',
            width: 1280,
            height: 720,
            thumbhash: 'abc',
            publicUrl: 'https://cdn.example.com/images/2026/05/foo.jpg?v=1',
          }
        }
        return null
      },
    })

    const image = findOne<ImageBlock>(body, 'image')
    expect(image.src).toBe('https://cdn.example.com/images/2026/05/foo.jpg?v=1')
    expect(image.storagePath).toBe('images/2026/05/foo.jpg')
    expect(image.width).toBe(1280)
    expect(image.height).toBe(720)
    expect(image.thumbhash).toBe('abc')
    expect(unresolvedImages).toHaveLength(0)
  })

  it('emits a musicPlayer block from `<MusicPlayer id="..." />` and reports the playerId', async () => {
    const md = '<MusicPlayer id="cpywgl6c2gdjjkql" />'
    const { body, musicPlayerIds } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    const player = findOne<MusicPlayerBlock>(body, 'musicPlayer')
    expect(player.playerId).toBe('cpywgl6c2gdjjkql')
    expect(musicPlayerIds).toEqual(['cpywgl6c2gdjjkql'])
  })

  it('rejects `<Friends />` so the migration script must strip it upstream', async () => {
    const md = '<Friends />'
    await expect(convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })).rejects.toThrow(
      /unsupported raw html/i,
    )
  })

  it('projects headings (h1-h4), thematic break, and ordered/unordered lists', async () => {
    const md = ['# Top', '## Sub', '---', '- a', '- b', '', '1. one', '2. two'].join('\n')
    const { body } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    const headingStyles = body
      .filter((b): b is TextBlock => b._type === 'block' && b.listItem === undefined)
      .map((b) => b.style)
    expect(headingStyles).toEqual(['h1', 'h2'])

    const lists = body.filter((b): b is TextBlock => b._type === 'block' && b.listItem !== undefined)
    expect(lists.map((b) => b.listItem)).toEqual(['bullet', 'bullet', 'number', 'number'])

    const hr = body.find((b) => b._type === 'horizontalRule')
    expect(hr?._type).toBe('horizontalRule')

    expect(() => validatePortableTextBody(body)).not.toThrow()
  })

  it('projects blockquote into one or more `blockquote`-styled blocks', async () => {
    const md = ['> First line.', '>', '> Second paragraph.'].join('\n')
    const { body } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    const quotes = body.filter((b): b is TextBlock => b._type === 'block' && b.style === 'blockquote')
    expect(quotes).toHaveLength(2)
    expect(quotes[0].children.map((s) => s.text).join('')).toContain('First line')
    expect(quotes[1].children.map((s) => s.text).join('')).toContain('Second paragraph')
  })

  it('supports one level of nested lists by stamping `level` on each item', async () => {
    const md = ['1. one', '2. two', '   - nested-a', '   - nested-b', '3. three'].join('\n')
    const { body } = await convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })

    const items = body.filter((b): b is TextBlock => b._type === 'block' && b.listItem !== undefined)
    expect(items.map((b) => `${b.listItem}@${b.level}`)).toEqual([
      'number@1',
      'number@1',
      'bullet@2',
      'bullet@2',
      'number@1',
    ])
    expect(() => validatePortableTextBody(body)).not.toThrow()
  })

  it('throws on an unsupported construct (fenced code block) so the migration aborts loudly', async () => {
    const md = ['```ts', 'const x = 1', '```'].join('\n')
    await expect(convertMdxBodyToPortableText(md, { resolveImageBySrc: noResolveImages })).rejects.toThrow(
      /Unsupported top-level mdast node 'code'/,
    )
  })
})
