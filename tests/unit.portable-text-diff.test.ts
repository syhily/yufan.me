import { describe, expect, it } from 'vite-plus/test'

import type { Block, PortableTextBody, TextBlock } from '@/shared/portable-text'

import { diffBodies, inlineCharDiff } from '@/ui/admin/pages/portable-text-diff'

// `diffBodies` and `inlineCharDiff` are the workhorses behind both
// the conflict resolver (DraftConflictDialog) and the revision
// history drawer. Pin their behaviour as plain-function contracts so
// the renderers above them can iterate on layout without breaking
// the diff semantics by accident.

function p(_key: string, text: string): TextBlock {
  return {
    _type: 'block',
    _key,
    style: 'normal',
    children: [{ _type: 'span', _key: `${_key}-s`, text }],
  }
}

describe('diffBodies', () => {
  it('returns "unchanged" entries for blocks present unchanged on both sides', () => {
    const left: PortableTextBody = [p('a', 'hello'), p('b', 'world')]
    const right: PortableTextBody = [p('a', 'hello'), p('b', 'world')]
    const diff = diffBodies(left, right)
    expect(diff).toHaveLength(2)
    expect(diff.every((entry) => entry.status === 'unchanged')).toBe(true)
  })

  it('flags blocks with the same _key but different content as "changed"', () => {
    const left: PortableTextBody = [p('a', 'hello local')]
    const right: PortableTextBody = [p('a', 'hello server')]
    const [entry] = diffBodies(left, right)
    expect(entry.status).toBe('changed')
    expect(entry.key).toBe('a')
    expect(entry.leftBlock).not.toBeNull()
    expect(entry.rightBlock).not.toBeNull()
  })

  it('flags _keys present only on the left as "leftOnly"', () => {
    const left: PortableTextBody = [p('a', 'shared'), p('b', 'local-only')]
    const right: PortableTextBody = [p('a', 'shared')]
    const diff = diffBodies(left, right)
    expect(diff.map((e) => e.status)).toEqual(['unchanged', 'leftOnly'])
    const [, leftOnly] = diff
    expect(leftOnly.rightBlock).toBeNull()
    expect(leftOnly.leftBlock).not.toBeNull()
  })

  it('flags _keys present only on the right as "rightOnly", appended after the left iteration', () => {
    const left: PortableTextBody = [p('a', 'shared')]
    const right: PortableTextBody = [p('a', 'shared'), p('b', 'server-only')]
    const diff = diffBodies(left, right)
    expect(diff.map((e) => e.status)).toEqual(['unchanged', 'rightOnly'])
    const [, rightOnly] = diff
    expect(rightOnly.leftBlock).toBeNull()
    expect(rightOnly.rightBlock).not.toBeNull()
  })

  it('preserves the left body iteration order and appends right-only blocks at the end', () => {
    // Even when right reorders + adds a new key, the diff lists
    // the left order verbatim then tacks on the new right key.
    // (Block reorders that share `_key` therefore look "unchanged"
    // — that's a deliberate simplification for our small bodies.)
    const left: PortableTextBody = [p('a', 'A'), p('b', 'B'), p('c', 'C')]
    const right: PortableTextBody = [p('c', 'C'), p('b', 'B'), p('a', 'A'), p('d', 'D')]
    const diff = diffBodies(left, right)
    expect(diff.map((e) => e.key)).toEqual(['a', 'b', 'c', 'd'])
    expect(diff.map((e) => e.status)).toEqual(['unchanged', 'unchanged', 'unchanged', 'rightOnly'])
  })

  it('treats custom-typed blocks (image/code/mermaid…) as full-block replacements', () => {
    // Custom blocks are diffed by JSON-string equality. The
    // renderer always shows them as a single replacement, never
    // char-level — verify the entry shape supports that.
    const left: PortableTextBody = [
      {
        _type: 'image',
        _key: 'img1',
        src: 'https://example.com/old.jpg',
        alt: 'old',
      },
    ]
    const right: PortableTextBody = [
      {
        _type: 'image',
        _key: 'img1',
        src: 'https://example.com/new.jpg',
        alt: 'new',
      },
    ]
    const [entry] = diffBodies(left, right)
    expect(entry.status).toBe('changed')
    expect((entry.leftBlock as Block)._type).toBe('image')
    expect((entry.rightBlock as Block)._type).toBe('image')
  })

  it('produces an empty list when both bodies are empty', () => {
    expect(diffBodies([], [])).toEqual([])
  })
})

describe('inlineCharDiff', () => {
  it('returns a single op=0 part when both strings are identical', () => {
    const parts = inlineCharDiff('hello world', 'hello world')
    expect(parts).toEqual([{ op: 0, text: 'hello world' }])
  })

  it('emits insertion (op=1) for text the right side adds', () => {
    const parts = inlineCharDiff('hello', 'hello world')
    // Cleanup-semantic merges character runs into "word"-ish chunks.
    expect(parts.some((p) => p.op === 1 && p.text.includes('world'))).toBe(true)
    // No deletions — left was a strict prefix.
    expect(parts.every((p) => p.op !== -1)).toBe(true)
  })

  it('emits deletion (op=-1) for text only present on the left', () => {
    const parts = inlineCharDiff('hello world', 'hello')
    expect(parts.some((p) => p.op === -1 && p.text.includes('world'))).toBe(true)
    expect(parts.every((p) => p.op !== 1)).toBe(true)
  })

  it('mixes insertions and deletions when both sides changed', () => {
    const parts = inlineCharDiff('cat sits', 'dog runs')
    const ops = new Set(parts.map((p) => p.op))
    expect(ops.has(-1)).toBe(true)
    expect(ops.has(1)).toBe(true)
  })

  it('handles empty strings on either side', () => {
    expect(inlineCharDiff('', '')).toEqual([])
    const left = inlineCharDiff('hello', '')
    expect(left).toEqual([{ op: -1, text: 'hello' }])
    const right = inlineCharDiff('', 'hello')
    expect(right).toEqual([{ op: 1, text: 'hello' }])
  })

  it('handles CJK input without exploding into per-character runs', () => {
    // diff-match-patch's `cleanupSemantic` should fold individual
    // codepoints into meaningful chunks even outside ASCII so the
    // diff renderer doesn't show alphabet-soup highlights.
    const parts = inlineCharDiff('你好世界', '你好朋友')
    // First two CJK chars are unchanged; the last two should be a
    // single insert + delete pair, not four individual ops.
    expect(parts.some((p) => p.op === 0 && p.text.includes('你好'))).toBe(true)
    expect(parts.filter((p) => p.op === -1).length).toBeLessThanOrEqual(1)
    expect(parts.filter((p) => p.op === 1).length).toBeLessThanOrEqual(1)
  })
})
