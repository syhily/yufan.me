// @ts-nocheck
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import type { AdminImageDto } from '@/shared/images'
import type { PortableTextBody } from '@/shared/portable-text'

export interface MigratePostMdxOptions {
  resolveImageBySrc: (src: string) => Promise<AdminImageDto | null>
}

export interface MigrateMdxResult {
  body: PortableTextBody
  unresolvedImages: string[]
  musicPlayerIds: string[]
}

interface ConvertContext {
  body: PortableTextBody
  unresolvedImages: string[]
  musicPlayerIds: string[]
  resolveImageBySrc: MigratePostMdxOptions['resolveImageBySrc']
  linkDefs: Map<string, string>
}

export async function convertPostMdxToPortableText(
  source: string,
  options: MigratePostMdxOptions,
): Promise<MigrateMdxResult> {
  // 1. String-level preprocessing
  const { source: preprocessed, solutionBlocks } = extractSolutionBlocks(source)
  const { source: noCenterImages, centeredImages } = unwrapCenterImages(preprocessed)
  const sourceNoCenterText = unwrapCenterText(noCenterImages)
  const sourceNoAlign = jsxAlignTagsToDataAlign(sourceNoCenterText)
  const sourceNoTables = htmlTablesToMarkdown(sourceNoAlign)
  const sourceNoRefs = inlineLinkReferences(sourceNoTables)
  const preprocessedSource = wrapBareMathEnvironments(sourceNoRefs)

  // 2. remark parse
  const tree = remark().use(remarkGfm).use(remarkMath).parse(preprocessedSource) as MdastRoot

  // Collect any link definitions that survived preprocessing
  const linkDefs = new Map<string, string>()
  for (const node of tree.children) {
    if (node.type === 'definition') {
      linkDefs.set(String(node.identifier), String(node.url))
    }
  }

  const ctx: ConvertContext = {
    body: [],
    unresolvedImages: [],
    musicPlayerIds: [],
    resolveImageBySrc: options.resolveImageBySrc,
    linkDefs,
  }

  for (const node of tree.children) {
    await emitTopLevelNode(node, ctx, { centeredImages, solutionBlocks })
  }

  return {
    body: ctx.body,
    unresolvedImages: ctx.unresolvedImages,
    musicPlayerIds: ctx.musicPlayerIds,
  }
}

// ---------- Preprocessors ----------

function extractSolutionBlocks(source: string): { source: string; solutionBlocks: Map<string, string> } {
  const solutionBlocks = new Map<string, string>()
  let counter = 0
  const replaced = source.replace(/<Solution>([\s\S]*?)<\/Solution>/g, (match, inner) => {
    const key = `__SOLUTION_${counter++}__`
    solutionBlocks.set(key, inner)
    return `\n\n> **SOLUTION_BLOCK:** ${key}\n\n`
  })
  return { source: replaced, solutionBlocks }
}

function unwrapCenterImages(source: string): { source: string; centeredImages: Set<string> } {
  const centeredImages = new Set<string>()
  const replaced = source.replace(/<center>\s*!\[([^\]]*)\]\(([^)]+)\)\s*<\/center>/g, (_, alt, url) => {
    centeredImages.add(url)
    return `![${alt}](${url})`
  })
  return { source: replaced, centeredImages }
}

function unwrapCenterText(source: string): string {
  return source.replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner) => {
    return `<p data-align="center">${inner.trim()}</p>`
  })
}

function jsxAlignTagsToDataAlign(source: string): string {
  return source.replace(
    /<p\s+style=\{\{\s*textAlign:\s*['"](left|center|right)['"]\s*\}\}>([\s\S]*?)<\/p>/gi,
    (_, align, inner) => `<p data-align="${align}">${inner}</p>`,
  )
}

function htmlTablesToMarkdown(source: string): string {
  return source.replace(/<table>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[] = []
    const trRegex = /<tr>([\s\S]*?)<\/tr>/gi
    let trMatch
    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const cells: string[] = []
      const cellRegex = /<t[hd]>([\s\S]*?)<\/t[hd]>/gi
      let cellMatch
      while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
        const cellText = cellMatch[1].replace(/<[^>]+>/g, '').trim()
        cells.push(cellText)
      }
      if (cells.length > 0) {
        rows.push('| ' + cells.join(' | ') + ' |')
      }
    }
    if (rows.length === 0) {
      return ''
    }
    const colCount = rows[0].split('|').length - 2
    const separator = '|' + ' --- |'.repeat(colCount)
    rows.splice(1, 0, separator)
    return rows.join('\n')
  })
}

function inlineLinkReferences(source: string): string {
  const defs = new Map<string, string>()
  const defRegex = /^\[([^\]]+)\]:\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*$/gm
  let match
  while ((match = defRegex.exec(source)) !== null) {
    defs.set(match[1], match[2])
  }

  let cleaned = source.replace(/^\[([^\]]+)\]:\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*$/gm, '')

  cleaned = cleaned.replace(/\[([^[\]]+)\]\[([^\]]+)\]/g, (full, text, id) => {
    const url = defs.get(id)
    if (url) return `[${text}](${url})`
    return full
  })

  cleaned = cleaned.replace(/\[([^\]]+)\]\[\]/g, (full, id) => {
    const url = defs.get(id)
    if (url) return `[${id}](${url})`
    return full
  })

  return cleaned
}

function wrapBareMathEnvironments(source: string): string {
  const parts = source.split(/(\$\$[\s\S]*?\$\$)/)
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(
      /(\\begin\{(align\*?|equation\*?|gather\*?)\}[\s\S]*?\\end\{(?:align\*?|equation\*?|gather\*?)\})/g,
      (match) => {
        const beginMatch = match.match(/\\begin\{([^}]+)\}/)
        const endMatch = match.match(/\\end\{([^}]+)\}/)
        if (beginMatch && endMatch && beginMatch[1] === endMatch[1]) {
          return '\n$$\n' + match + '\n$$\n'
        }
        return match
      },
    )
  }
  return parts.join('')
}

// ---------- Mdast types (minimal) ----------

interface MdastRoot {
  type: 'root'
  children: MdastNode[]
}

type MdastNode =
  | { type: 'paragraph'; children: MdastInline[] }
  | { type: 'heading'; depth: number; children: MdastInline[] }
  | { type: 'blockquote'; children: MdastNode[] }
  | { type: 'list'; ordered: boolean; children: MdastNode[] }
  | { type: 'listItem'; children: MdastNode[] }
  | { type: 'code'; lang?: string | null; value: string }
  | { type: 'math'; value: string }
  | { type: 'html'; value: string }
  | { type: 'table'; children: MdastNode[] }
  | { type: 'tableRow'; children: MdastNode[] }
  | { type: 'tableCell'; children: MdastInline[] }
  | { type: 'thematicBreak' }
  | { type: 'footnoteDefinition'; identifier: string; children: MdastNode[] }
  | { type: 'definition'; identifier: string; url: string }

interface MdastInline {
  type: string
  value?: string
  url?: string
  alt?: string
  children?: MdastInline[]
  identifier?: string
  label?: string
  lang?: string
  referenceType?: string
}

// ---------- Converters ----------

/**
 * Recursively extract all plain text from an mdast node (walking through
 * strong, emphasis, inlineCode, etc.). Used to detect SOLUTION_BLOCK
 * placeholders whose markdown markers (** and __) get parsed into inline
 * nodes by remark.
 */
function extractAllText(node: MdastNode | MdastInline): string {
  if (node.type === 'text' && 'value' in node) {
    return node.value ?? ''
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map(extractAllText).join('')
  }
  return ''
}

async function emitTopLevelNode(
  node: MdastNode,
  ctx: ConvertContext,
  meta: { centeredImages: Set<string>; solutionBlocks: Map<string, string> },
): Promise<void> {
  switch (node.type) {
    case 'paragraph':
      await emitParagraph(node, ctx, meta)
      return
    case 'heading':
      emitHeading(node, ctx)
      return
    case 'blockquote':
      await emitBlockquote(node, ctx, meta)
      return
    case 'list':
      await emitList(node, ctx, meta)
      return
    case 'code':
      emitCode(node, ctx)
      return
    case 'math':
      emitMathBlock(node, ctx)
      return
    case 'html':
      await emitHtml(node, ctx, meta)
      return
    case 'table':
      emitTable(node, ctx)
      return
    case 'thematicBreak':
      ctx.body.push({ _type: 'horizontalRule', _key: key() })
      return
    case 'footnoteDefinition':
      emitFootnoteDefinition(node, ctx)
      return
    case 'definition':
      // Silently ignore link reference definitions
      return
    case 'tableRow':
    case 'tableCell':
      // These should not appear at top level; ignore
      return
    default:
      // Silently ignore unknown top-level nodes
      return
  }
}

async function emitParagraph(
  node: { type: 'paragraph'; children: MdastInline[] },
  ctx: ConvertContext,
  meta: { centeredImages: Set<string>; solutionBlocks: Map<string, string> },
): Promise<void> {
  const text = extractAllText(node)
  const solutionMatch = text.match(/^SOLUTION_BLOCK:\s*(SOLUTION_\d+)$/)
  if (solutionMatch) {
    const raw = meta.solutionBlocks.get(`__${solutionMatch[1]}__`)
    if (raw) {
      const innerTree = remark().use(remarkGfm).use(remarkMath).parse(raw) as MdastRoot
      const children: PortableTextBody = []
      const childCtx: ConvertContext = { ...ctx, body: children }
      for (const child of innerTree.children) {
        await emitTopLevelNode(child, childCtx, meta)
      }
      ctx.body.push({ _type: 'solution', _key: key(), children: childCtx.body })
      return
    }
  }

  const block = await inlineChildrenToBlock(node.children, ctx, 'normal')
  if (block !== null) {
    ctx.body.push(block)
  }
}

function emitHeading(node: { type: 'heading'; depth: number; children: MdastInline[] }, ctx: ConvertContext): void {
  const style = node.depth === 1 ? 'h1' : node.depth === 2 ? 'h2' : node.depth === 3 ? 'h3' : 'h4'
  const block = inlineChildrenToBlockSync(node.children, ctx, style)
  if (block !== null) {
    ctx.body.push(block)
  }
}

async function emitBlockquote(
  node: { type: 'blockquote'; children: MdastNode[] },
  ctx: ConvertContext,
  meta: { centeredImages: Set<string>; solutionBlocks: Map<string, string> },
): Promise<void> {
  // The <Solution> placeholder is emitted as a blockquote ("> **SOLUTION_BLOCK:** ...")
  // so remark parses it as a blockquote node. Detect it here before falling back to
  // a regular blockquote block.
  if (node.children.length === 1 && node.children[0].type === 'paragraph') {
    const text = extractAllText(node.children[0])
    const solutionMatch = text.match(/^SOLUTION_BLOCK:\s*(SOLUTION_\d+)$/)
    if (solutionMatch) {
      const raw = meta.solutionBlocks.get(`__${solutionMatch[1]}__`)
      if (raw) {
        const innerTree = remark().use(remarkGfm).use(remarkMath).parse(raw) as MdastRoot
        const children: PortableTextBody = []
        const childCtx: ConvertContext = { ...ctx, body: children }
        for (const child of innerTree.children) {
          await emitTopLevelNode(child, childCtx, meta)
        }
        ctx.body.push({ _type: 'solution', _key: key(), children: childCtx.body })
        return
      }
    }
  }

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      const block = await inlineChildrenToBlock(child.children, ctx, 'blockquote')
      if (block !== null) {
        ctx.body.push(block)
      }
    }
  }
}

async function emitList(
  node: { type: 'list'; ordered: boolean; children: MdastNode[] },
  ctx: ConvertContext,
  meta: { centeredImages: Set<string>; solutionBlocks: Map<string, string> },
  level = 1,
): Promise<void> {
  const listItem = node.ordered ? 'number' : 'bullet'
  for (const item of node.children) {
    if (item.type !== 'listItem') {
      continue
    }
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        const block = await inlineChildrenToBlock(child.children, ctx, 'normal')
        if (block !== null) {
          ctx.body.push({ ...block, listItem, level })
        }
      }
      if (child.type === 'list') {
        await emitList(child as { type: 'list'; ordered: boolean; children: MdastNode[] }, ctx, meta, level + 1)
      }
    }
  }
}

function emitCode(node: { type: 'code'; lang?: string | null; value: string }, ctx: ConvertContext): void {
  if (node.lang === 'mermaid') {
    ctx.body.push({ _type: 'mermaid', _key: key(), code: node.value })
    return
  }
  ctx.body.push({
    _type: 'code',
    _key: key(),
    language: node.lang ?? 'text',
    code: node.value,
  })
}

function emitMathBlock(node: { type: 'math'; value: string }, ctx: ConvertContext): void {
  ctx.body.push({ _type: 'mathBlock', _key: key(), tex: node.value })
}

async function emitHtml(
  node: { type: 'html'; value: string },
  ctx: ConvertContext,
  meta: { centeredImages: Set<string>; solutionBlocks: Map<string, string> },
): Promise<void> {
  const val = node.value.trim()

  const musicMatch = val.match(/<MusicPlayer\s+id="([^"]+)"(?:\s+center)?(?:\s+auto)?\s*\/>/)
  if (musicMatch) {
    const id = musicMatch[1]
    const hasCenter = val.includes('center')
    const hasAuto = val.includes('auto')
    ctx.musicPlayerIds.push(id)
    ctx.body.push({
      _type: 'musicPlayer',
      _key: key(),
      playerId: id,
      center: hasCenter,
      auto: hasAuto,
    })
    return
  }

  const alignMatch = val.match(/^<p\s+data-align="(left|center|right)">([\s\S]*)<\/p>$/i)
  if (alignMatch) {
    const align = alignMatch[1] as 'left' | 'center' | 'right'
    const inner = alignMatch[2]
    const innerTree = remark().use(remarkGfm).use(remarkMath).parse(inner) as MdastRoot
    for (const child of innerTree.children) {
      if (child.type === 'paragraph') {
        const block = await inlineChildrenToBlock(child.children, ctx, 'normal')
        if (block !== null) {
          block.align = align
          ctx.body.push(block)
        }
      } else {
        await emitTopLevelNode(child, ctx, meta)
      }
    }
    return
  }

  // Flex div with side-by-side images → sequential image blocks
  const flexMatch = val.match(/^<div\s+style=\{\{\s*display:\s*['"]flex['"][^}]*\}\}>([\s\S]*)<\/div>$/i)
  if (flexMatch) {
    const inner = flexMatch[1]
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let imgMatch
    while ((imgMatch = imgRegex.exec(inner)) !== null) {
      await convertInlineNode({ type: 'image', url: imgMatch[2], alt: imgMatch[1] } as MdastInline, ctx)
    }
    return
  }

  // Extract any markdown images embedded in unrecognized HTML
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let imgMatch
  let hasImages = false
  while ((imgMatch = imgRegex.exec(val)) !== null) {
    hasImages = true
    await convertInlineNode({ type: 'image', url: imgMatch[2], alt: imgMatch[1] } as MdastInline, ctx)
  }
  if (hasImages) {
    return
  }

  // Silently ignore any other raw HTML
}

function emitTable(node: { type: 'table'; children: MdastNode[] }, ctx: ConvertContext): void {
  const rows: {
    _type: 'tableRow'
    _key: string
    cells: { _type: 'tableCell'; _key: string; isHeader?: boolean; content: unknown[]; markDefs?: unknown[] }[]
  }[] = []
  let rowIdx = 0
  for (const child of node.children) {
    if (child.type !== 'tableRow') {
      continue
    }
    const cells: { _type: 'tableCell'; _key: string; isHeader?: boolean; content: unknown[]; markDefs?: unknown[] }[] =
      []
    for (const cell of (child as { children: MdastNode[] }).children) {
      if (cell.type !== 'tableCell') {
        continue
      }
      const { spans, markDefs } = convertTableCellInlines((cell as { children: MdastInline[] }).children, ctx)
      const cellBlock: { _type: 'tableCell'; _key: string; content: unknown[]; markDefs?: unknown[] } = {
        _type: 'tableCell',
        _key: key(),
        content: spans,
      }
      if (rowIdx === 0) {
        cellBlock.isHeader = true
      }
      if (markDefs.length > 0) {
        cellBlock.markDefs = markDefs
      }
      cells.push(cellBlock)
    }
    rows.push({ _type: 'tableRow', _key: key(), cells })
    rowIdx++
  }
  ctx.body.push({ _type: 'table', _key: key(), rows, hasHeaderRow: true })
}

function emitFootnoteDefinition(
  node: { type: 'footnoteDefinition'; identifier: string; children: MdastNode[] },
  ctx: ConvertContext,
): void {
  const children: PortableTextBody = []
  const childCtx: ConvertContext = { ...ctx, body: children }
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      const block = inlineChildrenToBlockSync(child.children, childCtx, 'normal')
      if (block !== null) {
        childCtx.body.push(block)
      }
    }
  }
  const defKey = `fn-${node.identifier}`
  ctx.body.push({
    _type: 'footnoteDefinition',
    _key: defKey,
    index: Number(node.identifier) || 1,
    children: childCtx.body,
  })
}

// ---------- Inline converters ----------

async function inlineChildrenToBlock(
  children: MdastInline[],
  ctx: ConvertContext,
  style: string,
): Promise<{
  _type: 'block'
  _key: string
  style: string
  children: unknown[]
  markDefs?: unknown[]
  align?: string
} | null> {
  const { spans, markDefs } = await convertInlineChildren(children, ctx)
  if (spans.length === 0) {
    return null
  }
  return { _type: 'block', _key: key(), style, children: spans, markDefs }
}

function inlineChildrenToBlockSync(
  children: MdastInline[],
  ctx: ConvertContext,
  style: string,
): { _type: 'block'; _key: string; style: string; children: unknown[]; markDefs?: unknown[] } | null {
  const spans: unknown[] = []
  const markDefs: unknown[] = []
  for (const child of children) {
    const result = convertInlineNodeSync(child, ctx)
    if (result !== null) {
      if (Array.isArray(result.spans)) {
        spans.push(...result.spans)
      }
      if (Array.isArray(result.markDefs)) {
        markDefs.push(...result.markDefs)
      }
    }
  }
  if (spans.length === 0) {
    return null
  }
  return { _type: 'block', _key: key(), style, children: spans, markDefs: markDefs.length > 0 ? markDefs : undefined }
}

async function convertInlineChildren(
  children: MdastInline[],
  ctx: ConvertContext,
): Promise<{ spans: unknown[]; markDefs: unknown[] }> {
  const spans: unknown[] = []
  const markDefs: unknown[] = []
  for (const child of children) {
    const result = await convertInlineNode(child, ctx)
    if (result !== null) {
      if (Array.isArray(result.spans)) {
        spans.push(...result.spans)
      }
      if (Array.isArray(result.markDefs)) {
        markDefs.push(...result.markDefs)
      }
    }
  }
  return { spans, markDefs }
}

function convertInlineNodeSync(
  node: MdastInline,
  ctx: ConvertContext,
): { spans: unknown[]; markDefs?: unknown[] } | null {
  if (node.type === 'text') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value ?? '' }] }
  }
  if (node.type === 'strong') {
    const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'strong']
    })
    return { spans }
  }
  if (node.type === 'emphasis') {
    const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'em']
    })
    return { spans }
  }
  if (node.type === 'delete') {
    const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'strike-through']
    })
    return { spans }
  }
  if (node.type === 'inlineCode') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value ?? '', marks: ['code'] }] }
  }
  if (node.type === 'link') {
    const mdKey = key()
    const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), mdKey]
    })
    return {
      spans,
      markDefs: [{ _type: 'link', _key: mdKey, href: node.url ?? '' }],
    }
  }
  if (node.type === 'linkReference') {
    const url = ctx.linkDefs.get(node.identifier ?? '') ?? ''
    if (url) {
      const mdKey = key()
      const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
      const spans = inner.flatMap((r) => r!.spans)
      spans.forEach((s: Record<string, unknown>) => {
        s.marks = [...((s.marks as string[]) ?? []), mdKey]
      })
      return {
        spans,
        markDefs: [{ _type: 'link', _key: mdKey, href: url }],
      }
    }
    const inner = (node.children ?? []).map((c) => convertInlineNodeSync(c, ctx)).filter(Boolean)
    return { spans: inner.flatMap((r) => r!.spans) }
  }
  if (node.type === 'inlineMath') {
    const mdKey = key()
    return {
      spans: [{ _type: 'span', _key: key(), text: node.value ?? '', marks: [mdKey] }],
      markDefs: [{ _type: 'mathInline', _key: mdKey, tex: node.value ?? '' }],
    }
  }
  if (node.type === 'footnoteReference') {
    const mdKey = key()
    const index = Number(node.identifier) || 1
    return {
      spans: [{ _type: 'span', _key: key(), text: String(index), marks: [mdKey] }],
      markDefs: [{ _type: 'footnoteRef', _key: mdKey, targetKey: `fn-${node.identifier}`, index }],
    }
  }
  if (node.type === 'break') {
    return { spans: [{ _type: 'span', _key: key(), text: '\n' }] }
  }
  if (node.type === 'image') {
    return { spans: [{ _type: 'span', _key: key(), text: `[Image: ${node.alt ?? ''}]` }] }
  }
  // Fallback for unknown inline nodes with a value
  if (typeof node.value === 'string') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value }] }
  }
  return null
}

async function convertInlineNode(
  node: MdastInline,
  ctx: ConvertContext,
): Promise<{ spans: unknown[]; markDefs?: unknown[] } | null> {
  if (node.type === 'image') {
    const imgDto = await ctx.resolveImageBySrc(node.url ?? '')
    const block: Record<string, unknown> = {
      _type: 'image',
      _key: key(),
      alt: node.alt ?? '',
      src: node.url ?? '',
    }
    if (imgDto) {
      block.imageId = String(imgDto.id)
      block.storagePath = imgDto.storagePath
      block.width = imgDto.width
      block.height = imgDto.height
      block.thumbhash = imgDto.thumbhash
    } else {
      ctx.unresolvedImages.push(node.url ?? '')
    }
    ctx.body.push(block as never)
    return { spans: [] }
  }
  return convertInlineNodeSync(node, ctx)
}

// ---------- Table cell inline converter ----------

function convertTableCellInlines(
  children: MdastInline[],
  ctx: ConvertContext,
): { spans: unknown[]; markDefs: unknown[] } {
  const spans: unknown[] = []
  const markDefs: unknown[] = []
  for (const child of children) {
    const result = convertTableCellInlineNode(child, ctx)
    if (result !== null) {
      if (Array.isArray(result.spans)) {
        spans.push(...result.spans)
      }
      if (Array.isArray(result.markDefs)) {
        markDefs.push(...result.markDefs)
      }
    }
  }
  if (spans.length === 0) {
    spans.push({ _type: 'span', _key: key(), text: '' })
  }
  return { spans, markDefs }
}

function convertTableCellInlineNode(
  node: MdastInline,
  ctx: ConvertContext,
): { spans: unknown[]; markDefs?: unknown[] } | null {
  if (node.type === 'text') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value ?? '' }] }
  }
  if (node.type === 'strong') {
    const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'strong']
    })
    return { spans }
  }
  if (node.type === 'emphasis') {
    const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'em']
    })
    return { spans }
  }
  if (node.type === 'delete') {
    const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), 'strike-through']
    })
    return { spans }
  }
  if (node.type === 'inlineCode') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value ?? '', marks: ['code'] }] }
  }
  if (node.type === 'link') {
    const mdKey = key()
    const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
    const spans = inner.flatMap((r) => r!.spans)
    spans.forEach((s: Record<string, unknown>) => {
      s.marks = [...((s.marks as string[]) ?? []), mdKey]
    })
    return {
      spans,
      markDefs: [{ _type: 'link', _key: mdKey, href: node.url ?? '' }],
    }
  }
  if (node.type === 'linkReference') {
    const url = ctx.linkDefs.get(node.identifier ?? '') ?? ''
    if (url) {
      const mdKey = key()
      const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
      const spans = inner.flatMap((r) => r!.spans)
      spans.forEach((s: Record<string, unknown>) => {
        s.marks = [...((s.marks as string[]) ?? []), mdKey]
      })
      return {
        spans,
        markDefs: [{ _type: 'link', _key: mdKey, href: url }],
      }
    }
    const inner = (node.children ?? []).map((c) => convertTableCellInlineNode(c, ctx)).filter(Boolean)
    return { spans: inner.flatMap((r) => r!.spans) }
  }
  if (node.type === 'break') {
    return { spans: [{ _type: 'span', _key: key(), text: '\n' }] }
  }
  if (node.type === 'image') {
    if (node.alt) {
      return { spans: [{ _type: 'span', _key: key(), text: node.alt }] }
    }
    return { spans: [] }
  }
  if (node.type === 'inlineMath') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value ?? '', marks: ['code'] }] }
  }
  if (node.type === 'footnoteReference') {
    return { spans: [{ _type: 'span', _key: key(), text: String(node.identifier ?? '') }] }
  }
  if (typeof node.value === 'string') {
    return { spans: [{ _type: 'span', _key: key(), text: node.value }] }
  }
  return null
}

// ---------- Helpers ----------

let keyCounter = 0
function key(): string {
  return `k${++keyCounter}`
}
