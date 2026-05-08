import type { ReactNode } from 'react'

import { Fragment } from 'react'

import type { Friend } from '@/shared/catalog'
import type {
  Block,
  CodeBlock,
  FootnoteDefinitionBlock,
  FootnoteRefMarkDef,
  FriendsBlock,
  HorizontalRuleBlock,
  ImageBlock,
  LinkMarkDef,
  MarkDef,
  MathBlock,
  MathInlineMarkDef,
  MermaidBlock,
  MusicPlayerBlock,
  PortableTextBody as PortableTextBodyType,
  SolutionBlock,
  Span,
  TextBlock,
} from '@/shared/portable-text'

import { CodeBlock as CodeBlockComponent } from '@/ui/mdx/CodeBlock'
import { FootnoteProvider } from '@/ui/mdx/Footnotes'
import { ImageMetaProvider, type ImageMetaMap } from '@/ui/mdx/image-meta-context'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Friends } from '@/ui/mdx/page/Friends'
import { Solution } from '@/ui/mdx/solutions/Solution'

// SSR/CSR renderer that turns a PortableText body into a React tree.
// Designed to be a drop-in replacement for the existing MDX `<PageBody>`
// surface so `page.detail.tsx` can swap source representations without
// changing the surrounding document chrome.
//
// **Component reuse**: every custom block type maps onto an existing
// `@/ui/mdx/*` component so the public site renders bytes-for-bytes
// (modulo whitespace) like a hand-authored MDX page would.
//   - `image`              → `<MdxImg>` (thumbhash placeholder + lazy meta resolve)
//   - `code`               → `<CodeBlock>` (Shiki-pre-rendered or plain `<pre><code>`)
//   - `mathBlock` / `mathInline` → inline SVG when `svg` was pre-rendered at save time;
//     fallback to a `<code>` showing the raw TeX otherwise.
//   - `mermaid`            → inline SVG; fallback to `<pre class="mermaid">` so an
//     opt-in client-side mermaid script can still hydrate it.
//   - `musicPlayer`        → `<MusicPlayer>` (the same MDX widget)
//   - `solution`           → `<Solution>` wrapping the recursive children
//   - `friends`            → `<Friends>` driven by the loader's friends prop
//   - `footnoteDefinition` → `<li>` inside the auto-collected footnote list
//
// **Anchors**: heading nodes get an `id` derived from `slug`-collected
// keys (the editor maintains the same slug map via `collectHeadings`),
// so `/page#anchor` deep links keep working through the migration.

export interface PortableTextBodyProps {
  body: PortableTextBodyType
  /** Loader-supplied friends list, consumed by `friends` blocks. */
  friends?: readonly Friend[]
  /** Optional thumbhash hydration map. Mirrors the MDX `<PageBody>` prop. */
  imageMeta?: ImageMetaMap
}

export function PortableTextBody({ body, friends, imageMeta }: PortableTextBodyProps) {
  const ctx: RenderCtx = {
    headingIndex: new Map(),
    friends: friends ?? [],
    footnoteDefinitions: collectFootnoteDefinitions(body),
  }
  // Footnote definitions (block type `footnoteDefinition`) are
  // rendered together at the bottom of the body — never inline —
  // matching the GFM `<section data-footnotes>` convention.
  const inlineBody = body.filter((block) => block._type !== 'footnoteDefinition')
  const footnotes = body.filter((block): block is FootnoteDefinitionBlock => block._type === 'footnoteDefinition')

  return (
    <ImageMetaProvider value={imageMeta}>
      <FootnoteProvider>
        <div className="portable-text-body">
          {inlineBody.map((block) => (
            <RenderBlock key={block._key} block={block} ctx={ctx} />
          ))}
          {footnotes.length > 0 ? <FootnotesSection definitions={footnotes} ctx={ctx} /> : null}
        </div>
      </FootnoteProvider>
    </ImageMetaProvider>
  )
}

// --- Internals ---------------------------------------------------------------

interface RenderCtx {
  /** Tracks heading text → next disambiguation suffix for stable anchors. */
  headingIndex: Map<string, number>
  friends: readonly Friend[]
  /** All footnote definitions, indexed by `_key`, used by ref hover previews. */
  footnoteDefinitions: ReadonlyMap<string, FootnoteDefinitionBlock>
}

function collectFootnoteDefinitions(body: PortableTextBodyType): Map<string, FootnoteDefinitionBlock> {
  const out = new Map<string, FootnoteDefinitionBlock>()
  for (const block of body) {
    if (block._type === 'footnoteDefinition') {
      out.set(block._key, block)
    }
  }
  return out
}

interface RenderBlockProps {
  block: Block
  ctx: RenderCtx
}

function RenderBlock({ block, ctx }: RenderBlockProps): ReactNode {
  switch (block._type) {
    case 'block':
      return <TextBlockNode block={block} ctx={ctx} />
    case 'image':
      return <ImageBlockNode block={block} />
    case 'code':
      return <CodeBlockNode block={block} />
    case 'mathBlock':
      return <MathBlockNode block={block} />
    case 'mermaid':
      return <MermaidBlockNode block={block} />
    case 'horizontalRule':
      return <HorizontalRuleNode block={block} />
    case 'musicPlayer':
      return <MusicPlayerNode block={block} />
    case 'solution':
      return <SolutionBlockNode block={block} ctx={ctx} />
    case 'friends':
      return <FriendsBlockNode block={block} ctx={ctx} />
    case 'footnoteDefinition':
      // Rendered separately at the bottom; if a stray definition
      // shows up inline (e.g. inside a `solution`), drop it — the
      // collector above would have already pulled it.
      return null
  }
}

// --- Text blocks -------------------------------------------------------------

interface TextBlockNodeProps {
  block: TextBlock
  ctx: RenderCtx
}

function TextBlockNode({ block, ctx }: TextBlockNodeProps): ReactNode {
  const inline = renderSpans(block.children, block.markDefs ?? [], ctx)
  if (block.style === 'blockquote') {
    return <blockquote>{inline}</blockquote>
  }
  if (block.style === 'h1' || block.style === 'h2' || block.style === 'h3' || block.style === 'h4') {
    const Tag = block.style as 'h1' | 'h2' | 'h3' | 'h4'
    const text = block.children
      .map((span) => span.text)
      .join('')
      .trim()
    const id = anchorIdFor(text, ctx)
    return <Tag id={id}>{inline}</Tag>
  }
  // Lists are not flattened into a wrapping `<ul>` / `<ol>` here —
  // we emit each item as its own `<ul>` / `<ol>` containing one
  // `<li>`. The CSS resets margin between adjacent lists of the same
  // kind so the visual is identical; it keeps the renderer one-pass.
  if (block.listItem === 'bullet' || block.listItem === 'number') {
    const Wrapper = block.listItem === 'bullet' ? 'ul' : 'ol'
    return (
      <Wrapper>
        <li>{inline}</li>
      </Wrapper>
    )
  }
  return <p>{inline}</p>
}

function renderSpans(spans: readonly Span[], markDefs: readonly MarkDef[], ctx: RenderCtx): ReactNode {
  return spans.map((span) => <SpanNode key={span._key} span={span} markDefs={markDefs} ctx={ctx} />)
}

interface SpanNodeProps {
  span: Span
  markDefs: readonly MarkDef[]
  ctx: RenderCtx
}

function SpanNode({ span, markDefs, ctx }: SpanNodeProps): ReactNode {
  const marks = span.marks ?? []
  if (marks.length === 0) {
    return span.text
  }
  // Build innermost-out so the last mark is the outermost wrapper.
  // Decorator marks (bold, italic, …) wrap from the inside; markDef
  // marks (link, mathInline, footnoteRef) become the outermost wrapper
  // so a `<a>` containing `<strong>` is the natural shape.
  let node: ReactNode = span.text
  for (const mark of marks) {
    node = applyMark(node, mark, markDefs, ctx)
  }
  return node
}

function applyMark(node: ReactNode, markName: string, markDefs: readonly MarkDef[], ctx: RenderCtx): ReactNode {
  switch (markName) {
    case 'strong':
      return <strong>{node}</strong>
    case 'em':
      return <em>{node}</em>
    case 'underline':
      return <u>{node}</u>
    case 'strike-through':
      return <s>{node}</s>
    case 'code':
      return <code>{node}</code>
  }
  // markDef reference.
  const def = markDefs.find((entry) => entry._key === markName)
  if (def === undefined) {
    return <Fragment>{node}</Fragment>
  }
  switch (def._type) {
    case 'link':
      return <LinkMark def={def}>{node}</LinkMark>
    case 'mathInline':
      return <MathInlineMark def={def} />
    case 'footnoteRef':
      return <FootnoteRefMark def={def} ctx={ctx} />
  }
}

function LinkMark({ def, children }: { def: LinkMarkDef; children: ReactNode }) {
  return (
    <a href={def.href} rel={def.rel} target={def.target}>
      {children}
    </a>
  )
}

function MathInlineMark({ def }: { def: MathInlineMarkDef }) {
  if (def.svg !== undefined && def.svg !== '') {
    return <span className="math-inline" dangerouslySetInnerHTML={{ __html: def.svg }} />
  }
  return <code className="math-inline">{def.tex}</code>
}

function FootnoteRefMark({ def }: { def: FootnoteRefMarkDef; ctx: RenderCtx }) {
  // Render the bare `<sup><a href="#fn-N">[N]</a></sup>` markup.
  // The `<FootnoteProvider>` upstream wires hover previews, but only
  // for `<sup>` elements that render the same `data-footnote-ref`
  // anchor convention as historical MDX — we emit the same shape so
  // existing CSS + JS continues to work.
  return (
    <sup id={`user-content-fnref-${def.index}`} data-footnote-ref="">
      <a href={`#user-content-fn-${def.index}`} className="footnote-ref">
        {def.index}
      </a>
    </sup>
  )
}

// --- Custom blocks -----------------------------------------------------------

function ImageBlockNode({ block }: { block: ImageBlock }) {
  return (
    <figure>
      <MdxImg
        src={block.src}
        alt={block.alt ?? ''}
        width={block.width}
        height={block.height}
        data-thumbhash={block.thumbhash}
      />
      {block.caption !== undefined && block.caption !== '' ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  )
}

function CodeBlockNode({ block }: { block: CodeBlock }) {
  // When the editor pre-rendered Shiki HTML at save time we trust it
  // and emit it via `dangerouslySetInnerHTML`; otherwise fall back to
  // a plain `<pre><code>` that `<CodeBlock>` will style via the
  // language label + copy button.
  if (block.highlightedHtml !== undefined && block.highlightedHtml !== '') {
    return (
      <CodeBlockComponent
        className={block.language !== undefined ? `language-${block.language}` : undefined}
        data-language={block.language}
        dangerouslySetInnerHTML={{ __html: block.highlightedHtml }}
      />
    )
  }
  return (
    <CodeBlockComponent>
      <code
        className={block.language !== undefined ? `language-${block.language}` : undefined}
        data-language={block.language}
      >
        {block.code}
      </code>
    </CodeBlockComponent>
  )
}

function MathBlockNode({ block }: { block: MathBlock }) {
  if (block.svg !== undefined && block.svg !== '') {
    return <div className="math math-display" dangerouslySetInnerHTML={{ __html: block.svg }} />
  }
  return (
    <pre className="math math-display">
      <code>{block.tex}</code>
    </pre>
  )
}

function MermaidBlockNode({ block }: { block: MermaidBlock }) {
  if (block.svg !== undefined && block.svg !== '') {
    return <div className="mermaid" dangerouslySetInnerHTML={{ __html: block.svg }} />
  }
  return <pre className="mermaid">{block.code}</pre>
}

function HorizontalRuleNode({ block: _block }: { block: HorizontalRuleBlock }) {
  return <hr />
}

function MusicPlayerNode({ block }: { block: MusicPlayerBlock }) {
  return <MusicPlayer id={block.playerId} auto={block.auto} center={block.center} />
}

function SolutionBlockNode({ block, ctx }: { block: SolutionBlock; ctx: RenderCtx }) {
  return (
    <Solution>
      {block.children.map((child) => (
        <RenderBlock key={child._key} block={child} ctx={ctx} />
      ))}
    </Solution>
  )
}

function FriendsBlockNode({ block: _block, ctx }: { block: FriendsBlock; ctx: RenderCtx }) {
  return <Friends friends={[...ctx.friends]} />
}

// --- Footnotes section -------------------------------------------------------

function FootnotesSection({ definitions, ctx }: { definitions: readonly FootnoteDefinitionBlock[]; ctx: RenderCtx }) {
  return (
    <section className="footnotes" data-footnotes="">
      <h2 className="sr-only" id="footnote-label">
        Footnotes
      </h2>
      <ol>
        {definitions.map((definition) => (
          <li key={definition._key} id={`user-content-fn-${definition.index}`}>
            {definition.children.map((child) => (
              <RenderBlock key={child._key} block={child} ctx={ctx} />
            ))}
            <a
              href={`#user-content-fnref-${definition.index}`}
              data-footnote-backref=""
              aria-label="Back to reference"
              className="data-footnote-backref"
            >
              ↩
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

// --- Heading anchor IDs ------------------------------------------------------

function anchorIdFor(text: string, ctx: RenderCtx): string {
  // Slug = lowercase alphanumerics + dashes. Mirrors `github-slugger`'s
  // behaviour (used by `collectHeadings`) but only as a fallback —
  // ideally the upstream loader passes a pre-computed slug map.
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base === '') {
    return ''
  }
  const seen = ctx.headingIndex.get(base) ?? 0
  ctx.headingIndex.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen}`
}
