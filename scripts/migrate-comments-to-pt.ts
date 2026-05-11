/**
 * One-shot migration: convert legacy markdown stored in `comment.content`
 * into the new PortableText `comment.body` column.
 *
 * Run via `vp dlx vite-node scripts/migrate-comments-to-pt.ts` after
 * the drizzle `20260512000000_add_comment_body` migration has been
 * applied. The script is idempotent — comments that already carry a
 * non-empty `body` are skipped, so re-runs (e.g. after fixing a
 * conversion bug) are safe.
 *
 * Strategy: parse markdown with the existing `remark` + `remark-gfm` +
 * `remark-math` pipeline (same parser the legacy renderer relied on
 * via `marked`) and translate the resulting mdast into the comment
 * subset of PortableText. Anything outside the dialect (images,
 * headings, HTML, tables, thematic breaks) flattens to plain text so
 * the user's words are preserved even though the rendering
 * representation changes.
 */

import type {
  Blockquote,
  Code as MdCode,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  Link,
  List,
  ListItem,
  Paragraph,
  Parent,
  Root,
  RootContent,
  Strong,
  Table,
  Text as MdText,
  TableRow,
  ThematicBreak,
} from 'mdast'
import type { InlineMath, Math as MdMath } from 'mdast-util-math'

import { and, eq, isNull } from 'drizzle-orm'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import type { CommentBlock, CommentBody, CommentTextBlock } from '@/shared/pt/comment-schema'
import type { CodeBlock as PtCodeBlock, MathBlock as PtMathBlock, Span } from '@/shared/pt/schema'

import { canonicalizeCommentBody } from '@/server/comments/canonicalize'
import { db } from '@/server/db/pool'
import { comment } from '@/server/db/schema'
import { generateBlockKey } from '@/shared/pt/schema'

const processor = remark().use(remarkGfm).use(remarkMath)

interface InlineWalkState {
  spans: Span[]
  markDefs: NonNullable<CommentTextBlock['markDefs']>
  marks: string[]
  defRefs: string[]
}

function emitSpan(state: InlineWalkState, text: string): void {
  if (text === '') {
    return
  }
  state.spans.push({
    _type: 'span',
    _key: generateBlockKey(),
    text,
    marks: [...state.marks, ...state.defRefs],
  })
}

function walkInline(node: Parent, state: InlineWalkState): void {
  for (const child of node.children) {
    visitInline(child as RootContent, state)
  }
}

function visitInline(node: RootContent, state: InlineWalkState): void {
  switch (node.type) {
    case 'text': {
      emitSpan(state, (node as MdText).value)
      return
    }
    case 'strong': {
      state.marks.push('strong')
      walkInline(node as Strong, state)
      state.marks.pop()
      return
    }
    case 'emphasis': {
      state.marks.push('em')
      walkInline(node as Emphasis, state)
      state.marks.pop()
      return
    }
    case 'delete': {
      state.marks.push('strike-through')
      walkInline(node as Delete, state)
      state.marks.pop()
      return
    }
    case 'inlineCode': {
      const previous = state.marks
      state.marks = [...previous, 'code']
      emitSpan(state, node.value)
      state.marks = previous
      return
    }
    case 'link': {
      const link = node as Link
      const key = generateBlockKey()
      state.markDefs.push({ _type: 'link', _key: key, href: link.url })
      state.defRefs.push(key)
      walkInline(link, state)
      state.defRefs.pop()
      return
    }
    case 'inlineMath': {
      const im = node as InlineMath
      const key = generateBlockKey()
      state.markDefs.push({ _type: 'mathInline', _key: key, tex: im.value })
      state.defRefs.push(key)
      emitSpan(state, '')
      state.defRefs.pop()
      return
    }
    case 'break': {
      emitSpan(state, '\n')
      return
    }
    case 'html': {
      emitSpan(state, (node as Html).value)
      return
    }
    case 'image': {
      // Comment dialect rejects images — render the alt text inline so
      // the description survives.
      const img = node as Image
      if (img.alt && img.alt !== '') {
        emitSpan(state, img.alt)
      }
      return
    }
    default: {
      if ('children' in node && Array.isArray(node.children)) {
        walkInline(node as Parent, state)
      } else if ('value' in node && typeof node.value === 'string') {
        emitSpan(state, node.value)
      }
    }
  }
}

function paragraphToCommentBlock(node: Paragraph, style: 'normal' | 'blockquote' = 'normal'): CommentTextBlock {
  const state: InlineWalkState = { spans: [], markDefs: [], marks: [], defRefs: [] }
  walkInline(node, state)
  const block: CommentTextBlock = {
    _type: 'block',
    _key: generateBlockKey(),
    style,
    children: state.spans.length > 0 ? state.spans : [{ _type: 'span', _key: generateBlockKey(), text: '' }],
  }
  if (state.markDefs.length > 0) {
    block.markDefs = state.markDefs
  }
  return block
}

function listItemToBlocks(item: ListItem, ordered: boolean, level: number, out: CommentBody): void {
  for (const child of item.children) {
    if (child.type === 'paragraph') {
      const para = paragraphToCommentBlock(child)
      out.push({
        ...para,
        listItem: ordered ? 'number' : 'bullet',
        level,
      })
      continue
    }
    if (child.type === 'list') {
      listToBlocks(child, level + 1, out)
      continue
    }
    blockToCommentBlocks(child as RootContent, out)
  }
}

function listToBlocks(list: List, level: number, out: CommentBody): void {
  const ordered = list.ordered === true
  for (const item of list.children) {
    if (item.type === 'listItem') {
      listItemToBlocks(item, ordered, level, out)
    }
  }
}

function blockToCommentBlocks(node: RootContent, out: CommentBody): void {
  switch (node.type) {
    case 'paragraph': {
      out.push(paragraphToCommentBlock(node))
      return
    }
    case 'heading': {
      // Headings are outside the comment dialect — fold to a paragraph
      // so the text is preserved.
      const heading = node as Heading
      out.push(paragraphToCommentBlock({ type: 'paragraph', children: heading.children }))
      return
    }
    case 'blockquote': {
      for (const child of (node as Blockquote).children) {
        if (child.type === 'paragraph') {
          out.push(paragraphToCommentBlock(child, 'blockquote'))
        } else {
          blockToCommentBlocks(child as RootContent, out)
        }
      }
      return
    }
    case 'list': {
      listToBlocks(node as List, 1, out)
      return
    }
    case 'code': {
      const code = node as MdCode
      const block: PtCodeBlock = {
        _type: 'code',
        _key: generateBlockKey(),
        code: code.value,
      }
      if (typeof code.lang === 'string' && code.lang !== '') {
        block.language = code.lang
      }
      out.push(block as CommentBlock)
      return
    }
    case 'math': {
      const m = node as MdMath
      const block: PtMathBlock = {
        _type: 'mathBlock',
        _key: generateBlockKey(),
        tex: m.value,
      }
      out.push(block as CommentBlock)
      return
    }
    case 'thematicBreak':
    case 'html': {
      // Not part of the comment dialect — drop the silent payload
      // (`thematicBreak`) / flatten raw HTML to text-free no-op
      // (`html`); keeping them would corrupt validation.
      void (node as ThematicBreak | Html)
      return
    }
    case 'table': {
      // Best-effort flatten: serialise each row to plain text and
      // emit one paragraph per row joined by `|`.
      for (const row of (node as Table).children) {
        const cells: string[] = []
        for (const cell of (row as TableRow).children) {
          const stringified = processor.stringify({ type: 'root', children: cell.children as RootContent[] }).trim()
          cells.push(stringified)
        }
        const text = cells.join(' | ')
        if (text === '') {
          continue
        }
        out.push({
          _type: 'block',
          _key: generateBlockKey(),
          style: 'normal',
          children: [{ _type: 'span', _key: generateBlockKey(), text }],
        })
      }
      return
    }
    default: {
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children as RootContent[]) {
          blockToCommentBlocks(child, out)
        }
      }
    }
  }
}

export function mdastToCommentBody(markdown: string): CommentBody {
  const tree = processor.parse(markdown) as Root
  const out: CommentBody = []
  for (const child of tree.children) {
    blockToCommentBlocks(child, out)
  }
  if (out.length === 0) {
    out.push({
      _type: 'block',
      _key: generateBlockKey(),
      style: 'normal',
      children: [{ _type: 'span', _key: generateBlockKey(), text: markdown.trim() }],
    })
  }
  return out
}

interface MigrationSummary {
  migrated: number
  fallback: number
  skipped: number
  failed: number
}

async function migrate(): Promise<MigrationSummary> {
  const rows = await db
    .select({ id: comment.id, content: comment.content, body: comment.body })
    .from(comment)
    .where(and(isNull(comment.deletedAt), eq(comment.body, [])))

  const summary: MigrationSummary = { migrated: 0, fallback: 0, skipped: 0, failed: 0 }
  for (const row of rows) {
    if (Array.isArray(row.body) && row.body.length > 0) {
      summary.skipped += 1
      continue
    }
    const source = row.content ?? ''
    if (source.trim() === '') {
      summary.skipped += 1
      continue
    }
    let body: CommentBody
    let fallback = false
    try {
      body = mdastToCommentBody(source)
    } catch (error) {
      console.warn('[migrate] mdast → PT failed for comment', String(row.id), error)
      body = [
        {
          _type: 'block',
          _key: generateBlockKey(),
          style: 'normal',
          children: [{ _type: 'span', _key: generateBlockKey(), text: source }],
        },
      ]
      fallback = true
    }
    try {
      const canonical = await canonicalizeCommentBody(body)
      await db.update(comment).set({ body: canonical.body }).where(eq(comment.id, row.id))
      if (fallback) {
        summary.fallback += 1
      } else {
        summary.migrated += 1
      }
    } catch (error) {
      console.warn('[migrate] canonicalize failed for comment', String(row.id), error)
      summary.failed += 1
    }
  }
  return summary
}

async function main(): Promise<void> {
  const summary = await migrate()
  console.log(
    `[migrate] done — migrated=${summary.migrated} fallback=${summary.fallback} skipped=${summary.skipped} failed=${summary.failed}`,
  )
  process.exit(summary.failed === 0 ? 0 : 1)
}

void main()
