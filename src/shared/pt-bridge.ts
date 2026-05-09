import type {
  Block,
  CodeBlock,
  HorizontalRuleBlock,
  ImageBlock,
  LinkMarkDef,
  MarkDef,
  PortableTextBody,
  Span,
  StandardBlockStyle,
  TableBlock,
  TableCell,
  TableRow,
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
//      / mathBlock / mermaid / footnoteDefinition map to a PM
//      "block-card" node that carries the original PT block in its
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
  // PortableText represents lists as a flat sequence of `block`s
  // tagged with `listItem` (`bullet` | `number`) + a `level` (1 …).
  // ProseMirror needs them as nested `bulletList` / `orderedList`
  // trees. The state machine here scans consecutive list items and
  // emits a single root list node per "list streak" with deeper
  // levels nested inside the previous level's last `<li>`.
  //
  // Two streaks are joined into the same root list as long as the
  // root-level kind matches; switching from `bullet` to `number` at
  // level 1 starts a new root node. The same rule applies at deeper
  // levels — switching kinds at level 2 means the new sub-list lives
  // alongside (not inside) the previous one.
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block._type === 'block' && block.listItem !== undefined) {
      const consumed = consumeListStreak(out, blocks, i)
      i += consumed
      continue
    }
    out.push(blockToPmNode(block))
    i += 1
  }
}

interface PmListNode extends PmBlockNode {
  type: 'bulletList' | 'orderedList'
  content: PmNode[]
}

function consumeListStreak(out: PmNode[], blocks: readonly Block[], start: number): number {
  const first = blocks[start] as TextBlock
  const rootKind: 'bullet' | 'number' = first.listItem === 'bullet' ? 'bullet' : 'number'
  const root: PmListNode = {
    type: rootKind === 'bullet' ? 'bulletList' : 'orderedList',
    content: [],
  }
  // `stack[i]` is the active list at level `i + 1`. When we encounter
  // a deeper item we push a new sub-list inside the previous level's
  // last `<li>`; when we encounter a shallower item we pop back to
  // its level. When the root kind changes we stop the streak.
  const stack: PmListNode[] = [root]
  let i = start
  while (i < blocks.length) {
    const block = blocks[i]
    if (block._type !== 'block' || block.listItem === undefined) {
      break
    }
    const kind: 'bullet' | 'number' = block.listItem === 'bullet' ? 'bullet' : 'number'
    const level = Math.max(1, block.level ?? 1)
    if (level === 1 && kind !== rootKind) {
      break
    }
    while (stack.length > level) {
      stack.pop()
    }
    while (stack.length < level) {
      // Need to dive into a nested list. Attach it inside the last
      // `<li>` of the current top-of-stack list. If there isn't one
      // (malformed body that starts at level > 1), wrap with a
      // synthetic empty paragraph so the schema stays valid.
      const parentList = stack[stack.length - 1]
      let parentItem = parentList.content[parentList.content.length - 1] as PmBlockNode | undefined
      if (parentItem === undefined || parentItem.type !== 'listItem') {
        parentItem = { type: 'listItem', content: [{ type: 'paragraph' }] }
        parentList.content.push(parentItem)
      }
      const subKind: 'bullet' | 'number' = level === stack.length + 1 ? kind : 'bullet'
      const sub: PmListNode = {
        type: subKind === 'bullet' ? 'bulletList' : 'orderedList',
        content: [],
      }
      parentItem.content = [...(parentItem.content ?? []), sub]
      stack.push(sub)
    }
    // After level-walking, the top of stack must match the kind we
    // want at this level. If not, close the streak — we'll re-enter
    // for the new flavour as a sibling of the root list.
    const target = stack[stack.length - 1]
    const wanted = kind === 'bullet' ? 'bulletList' : 'orderedList'
    if (target.type !== wanted) {
      break
    }
    target.content.push({
      type: 'listItem',
      content: [textBlockToPmNode(block as TextBlock, /* asListItemChild */ true)],
    })
    i += 1
  }
  out.push(root)
  return i - start
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
    case 'table':
      return tableBlockToPmNode(block)
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
      imageId: block.imageId,
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

function tableBlockToPmNode(block: TableBlock): PmBlockNode {
  // Tiptap's table extension expects:
  //   table → tableRow* → (tableHeader | tableCell)+
  // Each header/cell must contain at least one block child;
  // we wrap the cell's inline spans in a single `paragraph`.
  const hasHeaderRow = block.hasHeaderRow ?? false
  return {
    type: 'table',
    attrs: { _key: block._key, hasHeaderRow },
    content: block.rows.map((row, rowIndex) => ({
      type: 'tableRow',
      attrs: { _key: row._key },
      content: row.cells.map((cell) => {
        const inlines: PmInlineNode[] = []
        for (const span of cell.content) {
          pushSpan(inlines, span, cell.markDefs ?? [])
        }
        const isHeader = cell.isHeader === true || (hasHeaderRow && rowIndex === 0)
        return {
          type: isHeader ? 'tableHeader' : 'tableCell',
          attrs: { _key: cell._key },
          content: [{ type: 'paragraph', content: inlines }],
        }
      }),
    })),
  }
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

/**
 * Canonicalise a PortableText body through the PT↔PM bridge.
 *
 * This collapses representational differences that are semantically
 * equivalent in the editor/runtime (for example list `level` omitted
 * vs. explicit `level: 1`, or mixed-list nesting expressed through
 * different intermediate PM trees).
 */
export function canonicalizePortableTextBody(body: PortableTextBody): PortableTextBody {
  return pmDocToBody(bodyToPmDoc(body))
}

/**
 * Semantic equality helper for conflict detection / "dirty" checks.
 *
 * Uses canonical PT forms so equivalent list shapes do not trigger
 * false-positive "content mismatch" prompts.
 */
export function arePortableTextBodiesEquivalent(left: PortableTextBody, right: PortableTextBody): boolean {
  return JSON.stringify(canonicalizePortableTextBody(left)) === JSON.stringify(canonicalizePortableTextBody(right))
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
      flattenList(node, out, ensureKey, 1)
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
        imageId: stringAttr(node.attrs, 'imageId'),
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
    case 'table': {
      out.push(pmTableToBlock(node, ensureKey))
      return
    }
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

function flattenList(
  node: PmBlockNode,
  out: Block[],
  ensureKey: (attrs: Record<string, unknown> | undefined) => string,
  level: number,
): void {
  const kind: 'bullet' | 'number' = node.type === 'bulletList' ? 'bullet' : 'number'
  const items = (node.content ?? []).filter(isBlock).filter((c) => c.type === 'listItem')
  for (const item of items) {
    const itemContent = (item.content ?? []).filter(isBlock)
    for (const child of itemContent) {
      if (child.type === 'paragraph') {
        out.push({
          ...paragraphToTextBlock(child, ensureKey, 'normal'),
          listItem: kind,
          level,
        })
        continue
      }
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        flattenList(child, out, ensureKey, level + 1)
        continue
      }
      // Drop other block types (the editor never inserts them inside
      // a list item, but PM JSON from a paste could contain them).
    }
  }
}

function pmTableToBlock(
  node: PmBlockNode,
  ensureKey: (attrs: Record<string, unknown> | undefined) => string,
): TableBlock {
  const rowNodes = (node.content ?? []).filter(isBlock).filter((c) => c.type === 'tableRow')
  const rows: TableRow[] = []
  let firstRowAllHeader = true
  let nonEmptyRows = false
  rowNodes.forEach((rowNode, rowIndex) => {
    nonEmptyRows = true
    const cellNodes = (rowNode.content ?? [])
      .filter(isBlock)
      .filter((c) => c.type === 'tableHeader' || c.type === 'tableCell')
    const cells: TableCell[] = cellNodes.map((cellNode) => pmCellToTableCell(cellNode, ensureKey))
    if (rowIndex === 0) {
      firstRowAllHeader = cells.length > 0 && cells.every((cell) => cell.isHeader === true)
    }
    rows.push({ _type: 'tableRow', _key: ensureKey(rowNode.attrs), cells })
  })
  // `hasHeaderRow` derived from the first row when the editor toggled
  // the header-row affordance. Saving it explicitly keeps the SSR
  // renderer cheap (it can pull `<thead>` from a single field instead
  // of scanning every cell). When the explicit attr is present on
  // the PM node we trust it, otherwise we infer from the cells.
  const explicit = node.attrs?.hasHeaderRow
  const hasHeaderRow = typeof explicit === 'boolean' ? explicit : nonEmptyRows && firstRowAllHeader
  // When the explicit `hasHeaderRow` is true and the first row's
  // cells weren't all marked `isHeader`, normalise so the SSR
  // renderer's "first row to thead" lift works regardless. When
  // explicit is false, drop any per-cell `isHeader` lingering on
  // row 0.
  if (rows.length > 0) {
    if (hasHeaderRow) {
      rows[0].cells = rows[0].cells.map((cell) => ({ ...cell, isHeader: true }))
    }
  }
  return {
    _type: 'table',
    _key: ensureKey(node.attrs),
    rows,
    ...(hasHeaderRow ? { hasHeaderRow: true } : {}),
  }
}

function pmCellToTableCell(
  node: PmBlockNode,
  ensureKey: (attrs: Record<string, unknown> | undefined) => string,
): TableCell {
  const isHeader = node.type === 'tableHeader'
  // The cell's first paragraph carries the inline content; ignore
  // additional block children (tables in our dialect can't nest
  // blocks inside cells — anything else is editor noise the user
  // can't produce through the supplied UI).
  const firstParagraph = (node.content ?? []).filter(isBlock).find((c) => c.type === 'paragraph')
  const content: Span[] = []
  const markDefs: LinkMarkDef[] = []
  let nextSpanKey = 0
  if (firstParagraph !== undefined) {
    const inlines = (firstParagraph.content ?? []).filter(isInline)
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
          continue
        }
        // Cells only allow link mark defs — drop mathInline /
        // footnoteRef so the cell stays valid against the strict
        // table-cell schema.
        if (conv.def._type !== 'link') {
          continue
        }
        marks.push(conv.def._key)
        if (!markDefs.some((existing) => existing._key === conv.def._key)) {
          markDefs.push(conv.def)
        }
      }
      content.push({
        _type: 'span',
        _key: spanKey,
        text: inline.text,
        marks: marks.length > 0 ? marks : undefined,
      })
    }
  }
  return {
    _type: 'tableCell',
    _key: ensureKey(node.attrs),
    content,
    ...(isHeader ? { isHeader: true } : {}),
    ...(markDefs.length > 0 ? { markDefs } : {}),
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
      // Reuse the editor-provided `_key` when the user merely
      // re-applies an existing link mark; otherwise derive a stable
      // key from the href so two spans inside the same paragraph
      // pointing at the same URL share a single `markDefs` entry
      // (the dedup happens inside `paragraphToTextBlock` keyed on
      // `_key`). Hashing the href avoids the previous "always equal
      // length-prefix" collision and keeps keys URL-safe.
      const explicit = stringAttr(mark.attrs, '_key')
      const key = explicit !== undefined && explicit !== '' ? explicit : `lk-${hashLinkHref(href)}`
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

// FNV-1a 32-bit hash. Plenty of collision resistance for the
// per-paragraph markDefs registry (a paragraph rarely carries more
// than a handful of links). We use base36 to keep `_key`s short and
// URL-safe.
function hashLinkHref(href: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < href.length; i += 1) {
    hash ^= href.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}
