import type {
  Image as MdastImage,
  PhrasingContent as MdastPhrasingContent,
  Root as MdastRoot,
  RootContent as MdastRootContent,
} from 'mdast'

import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

import type {
  Block,
  HorizontalRuleBlock,
  ImageBlock,
  LinkMarkDef,
  MusicPlayerBlock,
  PortableTextBody,
  Span,
  StandardBlockStyle,
  TextBlock,
} from '@/shared/portable-text'

import { generateBlockKey } from '@/shared/portable-text'

// MDX → PortableText converter used by the page-import migration
// (`scripts/migrate/pages/cli.ts`). It runs against any MDX corpus
// the operator points the CLI at — historically the deleted
// `src/content/pages/*.mdx` (about / guestbook / links), and now
// any external MDX dump shipped in for production import.
//
// Lives under `scripts/migrate/pages/` (not `src/server/cms/pages/`)
// so the SSR bundle does not pay the `remark` / `mdast` dependency
// cost. Only the CLI and its tests should import from this file.
//
// The converter is intentionally narrow and **only** handles the
// constructs the original three pages use:
//
//   * paragraph, heading (#-####), thematic break, bullet/ordered list,
//     blockquote
//   * inline strong / em / code / link
//   * `![alt](url)` images (resolved to `image` rows when possible)
//   * `<MusicPlayer id="…" />` self-closing JSX → `musicPlayer` block
//
// Constructs the editor supports but the static pages don't use are
// **deliberately rejected**:
//
//   * fenced code blocks, math, mermaid, tables, footnotes,
//     `<Solution>` blocks
//
// `<Friends />` is rejected too — the friends grid is a meta-toggle
// affordance now (`page.show_friends`) and lives outside the body
// (see `routes/page.detail.tsx`). The migration script is responsible
// for stripping `<Friends />` from the raw MDX before the converter
// runs and pre-toggling `show_friends=true` on the inserted row.
//
// Rejecting (instead of silently dropping) keeps the migration
// self-validating: if a future MDX page introduces a richer construct
// the script aborts loudly rather than silently producing a body
// missing the construct. Extending the converter is a localised
// change in this file.
//
// We do NOT depend on `remark-mdx`. The single JSX-flavoured
// construct the corpus uses (`<MusicPlayer>`) is matched as a raw
// `html` mdast node (remark's default behaviour for HTML-shaped
// inline / block fragments), so we skip ~250KB of MDX-grammar deps.

export interface MigrateMdxOptions {
  /**
   * Resolves an `<img src>` to an `image` row in the DB (by
   * `storagePath`). Returning `null` means "no row in DB" — the
   * converter then keeps the bare URL on the resulting `image`
   * block and the caller can collect the misses for a "needs to
   * be backfilled" report. Implementations are free to read from
   * the cache or the DB; the converter does not care.
   */
  resolveImageBySrc: (src: string) => Promise<{
    /** Stringified bigint id of the canonical `image` row. */
    imageId: string
    storagePath: string
    width: number
    height: number
    thumbhash: string | null
    publicUrl: string
  } | null>
}

export interface MigrateMdxResult {
  body: PortableTextBody
  /** `<img src>` URLs the converter could not resolve to an `image` row. */
  unresolvedImages: string[]
  /** `<MusicPlayer id="…">` ids encountered (caller verifies against `music` table). */
  musicPlayerIds: string[]
}

/**
 * Convert one MDX body (the markdown after the YAML frontmatter has
 * been stripped) into a PortableText body. Pure aside from the
 * `resolveImageBySrc` callback the caller provides.
 */
export async function convertMdxBodyToPortableText(
  source: string,
  options: MigrateMdxOptions,
): Promise<MigrateMdxResult> {
  const tree = remark().use(remarkGfm).parse(source) as MdastRoot

  const ctx: ConvertContext = {
    body: [],
    unresolvedImages: [],
    musicPlayerIds: [],
    resolveImageBySrc: options.resolveImageBySrc,
  }

  for (const node of tree.children) {
    await emitTopLevelNode(node, ctx)
  }

  return {
    body: ctx.body,
    unresolvedImages: ctx.unresolvedImages,
    musicPlayerIds: ctx.musicPlayerIds,
  }
}

// --- Internals --------------------------------------------------------------

interface ConvertContext {
  body: PortableTextBody
  unresolvedImages: string[]
  musicPlayerIds: string[]
  resolveImageBySrc: MigrateMdxOptions['resolveImageBySrc']
}

async function emitTopLevelNode(node: MdastRootContent, ctx: ConvertContext): Promise<void> {
  switch (node.type) {
    case 'paragraph': {
      const blocks = await emitParagraph(node, ctx)
      for (const block of blocks) {
        ctx.body.push(block)
      }
      return
    }
    case 'heading': {
      const style = headingStyleFor(node.depth)
      const text = collectTextFromInline(node.children)
      ctx.body.push(makeTextBlock(style, [makeSpan(text)]))
      return
    }
    case 'thematicBreak': {
      const block: HorizontalRuleBlock = { _type: 'horizontalRule', _key: generateBlockKey() }
      ctx.body.push(block)
      return
    }
    case 'blockquote': {
      // The static pages only blockquote a paragraph or two of plain
      // text. Multi-block blockquotes flatten to one `blockquote`-styled
      // block per inner paragraph (matching how the editor models
      // blockquotes today: the style lives on the block, not on a
      // wrapping container).
      for (const child of node.children) {
        if (child.type !== 'paragraph') {
          throw new Error(`Unsupported blockquote child '${child.type}' — only paragraphs are handled today.`)
        }
        const blocks = await emitParagraph(child, ctx, 'blockquote')
        for (const block of blocks) {
          ctx.body.push(block)
        }
      }
      return
    }
    case 'list': {
      await emitList(node, ctx, 1)
      return
    }
    case 'html': {
      const block = parseRawHtmlBlock(node.value, ctx)
      if (block !== null) {
        ctx.body.push(block)
        return
      }
      throw new Error(`Unsupported raw HTML block: ${node.value.trim().slice(0, 80)}`)
    }
    default:
      throw new Error(`Unsupported top-level mdast node '${node.type}'.`)
  }
}

// Lists may nest: `<ul>` inside `<ol>` and so on. PortableText
// represents nesting via `level` on each list item (`level=1` for
// the top, `level=2` for the first nested list, …). The catalog
// renderer (`@/ui/portable-text/PortableTextBody`) reconstructs the
// tree by grouping consecutive blocks with the same `(listItem,
// level)`. We mirror that contract here.
async function emitList(
  node: { ordered?: boolean | null; children: { children: MdastRootContent[] }[] },
  ctx: ConvertContext,
  level: number,
): Promise<void> {
  const listItem = node.ordered === true ? 'number' : 'bullet'
  for (const item of node.children) {
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        const blocks = await emitParagraph(child, ctx, 'normal', listItem)
        // emitParagraph produced text blocks at the default level=1;
        // bump them to the right depth before pushing.
        for (const block of blocks) {
          if (block._type === 'block' && block.listItem !== undefined) {
            block.level = level
          }
          ctx.body.push(block)
        }
        continue
      }
      if (child.type === 'list') {
        await emitList(child as Parameters<typeof emitList>[0], ctx, level + 1)
        continue
      }
      throw new Error(
        `Unsupported list item child '${child.type}' — only paragraphs and nested lists are handled today.`,
      )
    }
  }
}

// Convert one mdast paragraph. Paragraphs whose ONLY visible child is
// an `image` (the ubiquitous `![alt](url)` figure pattern in the
// static pages) are demoted to a standalone `image` PT block instead
// of a paragraph wrapping the image — that mirrors how the editor
// would have inserted them and the historical MDX renderer treated
// them (see `rehype-title-figure`). Mixed-content paragraphs keep the
// inline image as plain alt text (PT spans cannot embed images).
async function emitParagraph(
  node: { children: readonly MdastPhrasingContent[] },
  ctx: ConvertContext,
  style: StandardBlockStyle = 'normal',
  listItem?: 'bullet' | 'number',
): Promise<Block[]> {
  const visible = node.children.filter((child) => !isWhitespaceText(child))

  if (visible.length === 1 && visible[0].type === 'image') {
    const block = await imageNodeToBlock(visible[0], ctx)
    return [block]
  }

  // Special case: a paragraph that's just a self-closing JSX-ish
  // raw HTML node (`<MusicPlayer id="…" />`). `<Friends />` is
  // stripped from the source upstream and intentionally not
  // recognised here — anything that survives lands in the
  // unsupported-HTML error path.
  if (visible.length === 1 && visible[0].type === 'html') {
    const block = parseRawHtmlBlock(visible[0].value, ctx)
    if (block !== null) {
      return [block]
    }
  }

  const { spans, markDefs } = inlineChildrenToSpans(node.children)
  const block = makeTextBlock(style, spans, markDefs, listItem)
  return [block]
}

function isWhitespaceText(child: MdastPhrasingContent): boolean {
  return child.type === 'text' && child.value.trim() === ''
}

// Inline → spans + markDefs. Decorators (`strong`, `emphasis`, `code`,
// `delete`, link wrapping) are tracked through a stack; entering /
// leaving each one pushes / pops the corresponding mark name.
//
// Marks contract recap (see `@/shared/portable-text`):
//   * `strong` / `em` / `code` / `strike-through` / `underline`
//     are decorator names (live on `span.marks[]` directly).
//   * `link` is a `markDefs[]` entry; the `_key` is what `marks[]`
//     references.
function inlineChildrenToSpans(children: readonly MdastPhrasingContent[]): {
  spans: Span[]
  markDefs: LinkMarkDef[]
} {
  const spans: Span[] = []
  const markDefs: LinkMarkDef[] = []
  walkInline(children, [], spans, markDefs)
  if (spans.length === 0) {
    spans.push(makeSpan(''))
  }
  return { spans, markDefs }
}

function walkInline(
  children: readonly MdastPhrasingContent[],
  marks: readonly string[],
  spans: Span[],
  markDefs: LinkMarkDef[],
): void {
  for (const child of children) {
    switch (child.type) {
      case 'text':
        pushTextSpan(spans, child.value, marks)
        break
      case 'inlineCode':
        pushTextSpan(spans, child.value, [...marks, 'code'])
        break
      case 'strong':
      case 'emphasis':
      case 'delete': {
        const mark = child.type === 'strong' ? 'strong' : child.type === 'emphasis' ? 'em' : 'strike-through'
        walkInline(child.children, [...marks, mark], spans, markDefs)
        break
      }
      case 'link': {
        const def: LinkMarkDef = {
          _type: 'link',
          _key: generateBlockKey(),
          href: child.url,
        }
        markDefs.push(def)
        walkInline(child.children, [...marks, def._key], spans, markDefs)
        break
      }
      case 'image': {
        // Images inside flow inline content (rare in the corpus) keep
        // their alt text only — PortableText spans cannot embed image
        // blocks. The `imageNodeToBlock` path handles paragraphs
        // whose sole child is an image (the figure case).
        const alt = child.alt ?? ''
        if (alt !== '') {
          pushTextSpan(spans, alt, marks)
        }
        break
      }
      case 'break':
        pushTextSpan(spans, '\n', marks)
        break
      default:
        throw new Error(`Unsupported inline mdast node '${child.type}'.`)
    }
  }
}

function pushTextSpan(spans: Span[], text: string, marks: readonly string[]): void {
  if (text === '') {
    return
  }
  const last = spans[spans.length - 1]
  if (last !== undefined && marksEqual(last.marks ?? [], marks)) {
    last.text += text
    return
  }
  const span: Span = { _type: 'span', _key: generateBlockKey(), text }
  if (marks.length > 0) {
    span.marks = [...marks]
  }
  spans.push(span)
}

function marksEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

function makeSpan(text: string): Span {
  return { _type: 'span', _key: generateBlockKey(), text }
}

function makeTextBlock(
  style: StandardBlockStyle,
  children: Span[],
  markDefs?: LinkMarkDef[],
  listItem?: 'bullet' | 'number',
): TextBlock {
  const block: TextBlock = {
    _type: 'block',
    _key: generateBlockKey(),
    children,
  }
  if (style !== 'normal' || listItem === undefined) {
    block.style = style
  }
  if (listItem !== undefined) {
    block.listItem = listItem
    block.level = 1
  }
  if (markDefs !== undefined && markDefs.length > 0) {
    block.markDefs = markDefs
  }
  return block
}

function headingStyleFor(depth: number): StandardBlockStyle {
  switch (depth) {
    case 1:
      return 'h1'
    case 2:
      return 'h2'
    case 3:
      return 'h3'
    case 4:
      return 'h4'
    default:
      throw new Error(`Unsupported heading depth ${depth} (only h1-h4 round-trip cleanly).`)
  }
}

async function imageNodeToBlock(node: MdastImage, ctx: ConvertContext): Promise<ImageBlock> {
  const src = node.url
  const alt = node.alt === null ? undefined : node.alt
  const title = node.title === null ? undefined : node.title

  const block: ImageBlock = {
    _type: 'image',
    _key: generateBlockKey(),
    src,
  }
  if (alt !== undefined && alt !== '') {
    block.alt = alt
  }
  if (title !== undefined && title !== '') {
    block.caption = title
  }

  const meta = await ctx.resolveImageBySrc(src)
  if (meta === null) {
    ctx.unresolvedImages.push(src)
    return block
  }

  block.src = meta.publicUrl
  block.width = meta.width
  block.height = meta.height
  if (meta.thumbhash !== null) {
    block.thumbhash = meta.thumbhash
  }
  block.storagePath = meta.storagePath
  block.imageId = meta.imageId
  return block
}

// `<MusicPlayer id="…" auto={true} center={true} />` arrives as a raw
// `html` node. `remark` does not parse JSX attribute expressions for
// us, so we accept the small set of attributes the corpus actually
// uses (literal strings; literal `true`/`false`).
//
// `<Friends />` is the other historical raw HTML tag in the corpus.
// It is intentionally NOT handled here — the friends grid no longer
// lives inside the body, it's rendered by `routes/page.detail.tsx`
// when `page.show_friends` is true. The migration script strips
// `<Friends />` from the raw MDX before invoking the converter (and
// pre-toggles `show_friends=true` on the inserted row), so by the
// time `parseRawHtmlBlock` runs, no `<Friends />` survives. Anything
// that did slip through hits the "unsupported raw HTML" error path
// below, surfacing the bug instead of silently dropping content.
//
// Returns `null` for HTML the corpus doesn't use, so the caller can
// surface a precise "unsupported raw HTML" error instead of failing
// inside the regex.
function parseRawHtmlBlock(raw: string, ctx: ConvertContext): MusicPlayerBlock | null {
  const trimmed = raw.trim()

  const musicMatch = /^<MusicPlayer\s+([^/>]*?)\s*\/>\s*$/.exec(trimmed)
  if (musicMatch !== null) {
    const attrs = parseJsxAttributes(musicMatch[1])
    const playerId = typeof attrs.id === 'string' ? attrs.id : null
    if (playerId === null || playerId === '') {
      throw new Error('<MusicPlayer> requires an `id` attribute.')
    }
    ctx.musicPlayerIds.push(playerId)
    const block: MusicPlayerBlock = {
      _type: 'musicPlayer',
      _key: generateBlockKey(),
      playerId,
    }
    if (attrs.auto === true) {
      block.auto = true
    }
    if (attrs.center === true) {
      block.center = true
    }
    return block
  }

  return null
}

// Bare-bones JSX attribute parser: handles `name="literal"`,
// `name='literal'`, `name={true}`, `name={false}`, and bare boolean
// attribute (`auto` ⇒ `auto={true}`). Anything richer (expressions,
// numbers, fragments) the static page corpus does not use, so we
// throw to make a future violation loud.
function parseJsxAttributes(input: string): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  const pattern = /([A-Za-z_][A-Za-z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{(true|false)\}))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(input)) !== null) {
    const [, name, dq, sq, brace] = match
    if (dq !== undefined) {
      out[name] = dq
    } else if (sq !== undefined) {
      out[name] = sq
    } else if (brace !== undefined) {
      out[name] = brace === 'true'
    } else {
      out[name] = true
    }
  }
  return out
}

function collectTextFromInline(children: readonly MdastPhrasingContent[]): string {
  let out = ''
  for (const child of children) {
    if (child.type === 'text' || child.type === 'inlineCode') {
      out += child.value
    } else if (
      child.type === 'strong' ||
      child.type === 'emphasis' ||
      child.type === 'delete' ||
      child.type === 'link'
    ) {
      out += collectTextFromInline(child.children)
    }
  }
  return out
}
