import type {
  Block,
  CodeBlock,
  HorizontalRuleBlock,
  ImageBlock,
  MarkDef,
  PortableTextBody,
  Span,
  StandardBlockStyle,
  TextBlock,
} from '@/shared/portable-text'

// PortableText ↔ ProseMirror bridge.
//
// PortableText (PT) is the canonical on-the-wire representation: a flat
// array of blocks. ProseMirror (PM) is the runtime tree shape Tiptap
// expects. The two cross at the editor's `useEditor({ content })` and
// `editor.getJSON()` calls; this module is the only bidirectional
// translation point so future Tiptap upgrades only touch PM-side
// idioms in one file.
//
// **Design rules**
//
//   1. **Round-trip safety on the standard subset.** For the standard
//      blocks (text/marks/lists/headings/blockquote/code/image/
//      horizontalRule) `bodyToPmDoc(pmDocToBody(x))` MUST equal `x`.
//      This guarantee is asserted by `tests/contract.pt-bridge.test.ts`.
//   2. **Custom blocks pass through opaquely.** musicPlayer / solution
//      / mathBlock / mermaid / friends / footnoteDefinition map to a
//      PM "block-card" node that carries the original PT block in its
//      `attrs.payload`. The Tiptap render hooks unpack `payload`; the
//      reverse path simply re-serialises it. No edit operation ever
//      mutates `payload` mid-flight, so the round trip stays clean even
//      when the editor lacks a rich UI for a given custom block.
//   3. **Keys are preserved on the way in.** The PM node's `attrs._key`
//      mirrors the PT `_key`. New nodes inserted in the editor get a
//      fresh key on save (the editor reducer fills missing `_key` via
//      `generateBlockKey()`).
//   4. **No DOM imports.** This module runs in the browser bundle but
//      stays free of `window`/`document` so SSR can sanitise PT
//      payloads through the same data path used by the editor.
//
// The custom-node payload pass-through means a fresh editor that
// hasn't yet learned to render a `musicPlayer` block still loads,
// edits text around it, and saves without losing the block. New custom
// node types only need (a) a Tiptap node spec for in-editor render +
// keyboard interactions and (b) optional bridge logic if their PM-side
// shape diverges from the generic block-card.

// --- ProseMirror node shape -------------------------------------------------

export interface PmDoc {
  type: 'doc'
  content: PmNode[]
}

export type PmNode = PmBlockNode | PmInlineNode

export interface PmBlockNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
  marks?: PmMark[]
}

export interface PmInlineNode {
  type: 'text'
  text: string
  marks?: PmMark[]
}

export interface PmMark {
  type: string
  attrs?: Record<string, unknown>
}

// --- PT → PM ----------------------------------------------------------------

/** Convert a PortableText body into a ProseMirror `doc` node. */
export function bodyToPmDoc(body: PortableTextBody): PmDoc {
  const content: PmNode[] = []
  pushBlocks(content, body)
  // ProseMirror's `doc` schema disallows an empty body. Insert a
  // single empty paragraph so freshly-created pages can be opened in
  // the editor without bouncing on the schema validator.
  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }
  return { type: 'doc', content }
}

function pushBlocks(out: PmNode[], blocks: readonly Block[]): void {
  // Lists need to be folded into a single PM `bulletList` /
  // `orderedList` node when consecutive PT text blocks share the same
  // `listItem`. We accumulate then flush.
  let listKind: 'bullet' | 'number' | null = null
  let listLevel = 1
  let listItems: PmNode[] = []

  function flushList() {
    if (listKind === null) {
      return
    }
    out.push({
      type: listKind === 'bullet' ? 'bulletList' : 'orderedList',
      content: listItems,
    })
    listKind = null
    listLevel = 1
    listItems = []
  }

  for (const block of blocks) {
    if (block._type === 'block' && block.listItem) {
      const kind = block.listItem === 'bullet' ? 'bullet' : 'number'
      const level = block.level ?? 1
      if (listKind !== kind || listLevel !== level) {
        flushList()
        listKind = kind
        listLevel = level
      }
      listItems.push({ type: 'listItem', content: [textBlockToPmNode(block, /* asListItemChild */ true)] })
      continue
    }
    flushList()
    out.push(blockToPmNode(block))
  }
  flushList()
}

function blockToPmNode(block: Block): PmBlockNode {
  switch (block._type) {
    case 'block':
      return textBlockToPmNode(block, false)
    case 'image':
      return imageBlockToPmNode(block)
    case 'code':
      return codeBlockToPmNode(block)
    case 'horizontalRule':
      return horizontalRuleBlockToPmNode(block)
    default:
      return customBlockToPmNode(block)
  }
}

function textBlockToPmNode(block: TextBlock, asListItemChild: boolean): PmBlockNode {
  const inlines: PmInlineNode[] = []
  for (const span of block.children) {
    pushSpan(inlines, span, block.markDefs ?? [])
  }
  if (asListItemChild) {
    return { type: 'paragraph', attrs: { _key: block._key }, content: inlines }
  }
  if (block.style === 'blockquote') {
    return {
      type: 'blockquote',
      attrs: { _key: block._key },
      content: [{ type: 'paragraph', content: inlines }],
    }
  }
  const headingLevel = headingLevelFromStyle(block.style)
  if (headingLevel !== null) {
    return {
      type: 'heading',
      attrs: { _key: block._key, level: headingLevel },
      content: inlines,
    }
  }
  return { type: 'paragraph', attrs: { _key: block._key }, content: inlines }
}

function pushSpan(out: PmInlineNode[], span: Span, markDefs: readonly MarkDef[]): void {
  if (span.text === '') {
    return
  }
  const marks = (span.marks ?? []).map((markName) => spanMarkToPmMark(markName, markDefs))
  out.push({ type: 'text', text: span.text, marks: marks.length > 0 ? marks : undefined })
}

function spanMarkToPmMark(markName: string, markDefs: readonly MarkDef[]): PmMark {
  switch (markName) {
    case 'strong':
      return { type: 'bold' }
    case 'em':
      return { type: 'italic' }
    case 'underline':
      return { type: 'underline' }
    case 'strike-through':
      return { type: 'strike' }
    case 'code':
      return { type: 'code' }
  }
  // Reference into markDefs: link / mathInline / footnoteRef.
  const def = markDefs.find((entry) => entry._key === markName)
  if (!def) {
    return { type: 'unknownMark', attrs: { _key: markName } }
  }
  switch (def._type) {
    case 'link':
      return {
        type: 'link',
        attrs: { _key: def._key, href: def.href, rel: def.rel, target: def.target },
      }
    case 'mathInline':
      return { type: 'mathInline', attrs: { _key: def._key, tex: def.tex, svg: def.svg } }
    case 'footnoteRef':
      return {
        type: 'footnoteRef',
        attrs: { _key: def._key, targetKey: def.targetKey, index: def.index },
      }
  }
}

function imageBlockToPmNode(block: ImageBlock): PmBlockNode {
  return {
    type: 'image',
    attrs: {
      _key: block._key,
      src: block.src,
      alt: block.alt,
      caption: block.caption,
      width: block.width,
      height: block.height,
      thumbhash: block.thumbhash,
      storagePath: block.storagePath,
    },
  }
}

function codeBlockToPmNode(block: CodeBlock): PmBlockNode {
  return {
    type: 'codeBlock',
    attrs: { _key: block._key, language: block.language, highlightedHtml: block.highlightedHtml },
    content: block.code === '' ? undefined : [{ type: 'text', text: block.code }],
  }
}

function horizontalRuleBlockToPmNode(_block: HorizontalRuleBlock): PmBlockNode {
  return { type: 'horizontalRule', attrs: { _key: _block._key } }
}

function customBlockToPmNode(block: Block): PmBlockNode {
  // Pass-through node. Tiptap renders these with a generic
  // "block-card" view that reads `attrs.payload` and dispatches to
  // the right per-`_type` React component.
  return {
    type: 'blockCard',
    attrs: { _key: block._key, _ptType: block._type, payload: block },
  }
}

function headingLevelFromStyle(style: StandardBlockStyle | undefined): number | null {
  switch (style) {
    case 'h1':
      return 1
    case 'h2':
      return 2
    case 'h3':
      return 3
    case 'h4':
      return 4
    default:
      return null
  }
}

// --- PM → PT ----------------------------------------------------------------

/** Convert a ProseMirror `doc` node back into a PortableText body. */
export function pmDocToBody(doc: PmDoc): PortableTextBody {
  const out: Block[] = []
  let nextKey = 0
  const ensureKey = (attrs: Record<string, unknown> | undefined): string => {
    if (attrs && typeof attrs._key === 'string' && attrs._key !== '') {
      return attrs._key
    }
    nextKey += 1
    return `pm-${nextKey.toString(36)}`
  }

  for (const node of doc.content) {
    pushPmNode(out, node, ensureKey)
  }
  return out
}

function pushPmNode(
  out: Block[],
  node: PmNode,
  ensureKey: (attrs: Record<string, unknown> | undefined) => string,
): void {
  if (isInline(node)) {
    return
  }
  switch (node.type) {
    case 'paragraph':
      out.push(paragraphToTextBlock(node, ensureKey, 'normal'))
      return
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
      const style = headingStyleFromLevel(level)
      out.push(paragraphToTextBlock(node, ensureKey, style))
      return
    }
    case 'blockquote': {
      // PM blockquotes wrap a paragraph; lift the inline content up
      // into a single PT block with `style: 'blockquote'`. Multiple
      // paragraphs inside one blockquote flatten into successive
      // blockquote blocks (PT has no nested-quote concept beyond
      // adjacency).
      const child = (node.content ?? []).filter(isBlock)
      const key = ensureKey(node.attrs)
      for (const para of child) {
        out.push(paragraphToTextBlock({ ...para, attrs: { ...para.attrs, _key: key } }, ensureKey, 'blockquote'))
      }
      return
    }
    case 'bulletList':
    case 'orderedList': {
      const kind = node.type === 'bulletList' ? 'bullet' : 'number'
      const items = (node.content ?? []).filter(isBlock).filter((c) => c.type === 'listItem')
      for (const item of items) {
        const itemContent = (item.content ?? []).filter(isBlock)
        for (const para of itemContent) {
          if (para.type !== 'paragraph') {
            continue
          }
          out.push({
            ...paragraphToTextBlock(para, ensureKey, 'normal'),
            listItem: kind,
            level: 1,
          })
        }
      }
      return
    }
    case 'image':
      out.push({
        _type: 'image',
        _key: ensureKey(node.attrs),
        src: typeof node.attrs?.src === 'string' ? node.attrs.src : '',
        alt: stringAttr(node.attrs, 'alt'),
        caption: stringAttr(node.attrs, 'caption'),
        width: numberAttr(node.attrs, 'width'),
        height: numberAttr(node.attrs, 'height'),
        thumbhash: stringAttr(node.attrs, 'thumbhash'),
        storagePath: stringAttr(node.attrs, 'storagePath'),
      })
      return
    case 'codeBlock': {
      const text = (node.content ?? [])
        .filter((child): child is PmInlineNode => isInline(child))
        .map((child) => child.text)
        .join('')
      out.push({
        _type: 'code',
        _key: ensureKey(node.attrs),
        code: text,
        language: stringAttr(node.attrs, 'language'),
        highlightedHtml: stringAttr(node.attrs, 'highlightedHtml'),
      })
      return
    }
    case 'horizontalRule':
      out.push({ _type: 'horizontalRule', _key: ensureKey(node.attrs) })
      return
    case 'blockCard': {
      // Pass-through custom node. Trust the payload — the editor's
      // schema guarantees it's a `Block` (the `payload` attribute is
      // typed as `Block` in the Tiptap node spec). The API perimeter
      // re-validates against `portableTextBodySchema` on save, so a
      // tampered payload still fails validation.
      const payload = node.attrs?.payload
      if (payload && typeof payload === 'object' && '_type' in payload) {
        out.push(payload as Block)
      }
      return
    }
  }
}

function paragraphToTextBlock(
  node: PmBlockNode,
  ensureKey: (attrs: Record<string, unknown> | undefined) => string,
  style: StandardBlockStyle,
): TextBlock {
  const children: Span[] = []
  const markDefs: MarkDef[] = []
  let nextSpanKey = 0
  const inlines = (node.content ?? []).filter(isInline)
  for (const inline of inlines) {
    nextSpanKey += 1
    const spanKey = `s-${nextSpanKey.toString(36)}`
    const marks: string[] = []
    for (const mark of inline.marks ?? []) {
      const conv = pmMarkToSpanMark(mark)
      if (conv === null) {
        continue
      }
      if ('decorator' in conv) {
        marks.push(conv.decorator)
      } else {
        marks.push(conv.def._key)
        if (!markDefs.some((existing) => existing._key === conv.def._key)) {
          markDefs.push(conv.def)
        }
      }
    }
    children.push({
      _type: 'span',
      _key: spanKey,
      text: inline.text,
      marks: marks.length > 0 ? marks : undefined,
    })
  }
  return {
    _type: 'block',
    _key: ensureKey(node.attrs),
    style,
    children,
    markDefs: markDefs.length > 0 ? markDefs : undefined,
  }
}

function pmMarkToSpanMark(mark: PmMark): { decorator: string } | { def: MarkDef } | null {
  switch (mark.type) {
    case 'bold':
      return { decorator: 'strong' }
    case 'italic':
      return { decorator: 'em' }
    case 'underline':
      return { decorator: 'underline' }
    case 'strike':
      return { decorator: 'strike-through' }
    case 'code':
      return { decorator: 'code' }
    case 'link': {
      const href = stringAttr(mark.attrs, 'href') ?? ''
      const key = stringAttr(mark.attrs, '_key') ?? `lk-${href.length.toString(36)}-${href.slice(0, 4)}`
      return {
        def: {
          _type: 'link',
          _key: key,
          href,
          rel: stringAttr(mark.attrs, 'rel'),
          target: stringAttr(mark.attrs, 'target'),
        },
      }
    }
    case 'mathInline': {
      const tex = stringAttr(mark.attrs, 'tex') ?? ''
      const key = stringAttr(mark.attrs, '_key') ?? `mi-${tex.length.toString(36)}`
      return {
        def: { _type: 'mathInline', _key: key, tex, svg: stringAttr(mark.attrs, 'svg') },
      }
    }
    case 'footnoteRef': {
      const targetKey = stringAttr(mark.attrs, 'targetKey') ?? ''
      const key = stringAttr(mark.attrs, '_key') ?? `fr-${targetKey}`
      const index = numberAttr(mark.attrs, 'index') ?? 1
      return { def: { _type: 'footnoteRef', _key: key, targetKey, index } }
    }
    default:
      return null
  }
}

function headingStyleFromLevel(level: number): StandardBlockStyle {
  switch (level) {
    case 1:
      return 'h1'
    case 2:
      return 'h2'
    case 3:
      return 'h3'
    case 4:
      return 'h4'
    default:
      return 'h4'
  }
}

function isInline(node: PmNode): node is PmInlineNode {
  return node.type === 'text'
}

function isBlock(node: PmNode): node is PmBlockNode {
  return node.type !== 'text'
}

function stringAttr(attrs: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!attrs) {
    return undefined
  }
  const value = attrs[key]
  return typeof value === 'string' ? value : undefined
}

function numberAttr(attrs: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!attrs) {
    return undefined
  }
  const value = attrs[key]
  return typeof value === 'number' ? value : undefined
}
