import {
  PortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
  type PortableTextTypeComponentProps,
} from '@portabletext/react'
import GithubSlugger from 'github-slugger'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type {
  CodeBlock,
  FootnoteDefinitionBlock,
  FootnoteRefMarkDef,
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
  TableBlock,
} from '@/shared/portable-text'

import { CodeBlock as CodeBlockComponent } from '@/ui/mdx/CodeBlock'
import { FootnoteProvider } from '@/ui/mdx/Footnotes'
import { ImageMetaProvider, type ImageMetaMap } from '@/ui/mdx/image-meta-context'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Solution } from '@/ui/mdx/solutions/Solution'

// SSR/CSR renderer for PortableText. Built on top of `@portabletext/react`'s
// composable component map so the standard text/list/heading/decorator
// pipeline (including consecutive list-item folding) is delegated to the
// official toolkit, while every yufan.me-specific block / mark
// (`image`, `code`, `mathBlock`, `mermaid`, `horizontalRule`,
// `musicPlayer`, `solution`, `footnoteDefinition`, `table`,
// plus `mathInline` / `footnoteRef` mark defs) is handled by an
// inline component declared in this file.
//
// **Component reuse**: every custom block type maps onto an existing
// `@/ui/mdx/*` component so the public site renders bytes-for-bytes
// (modulo whitespace) like a hand-authored MDX page would.
//
// **Anchors**: heading nodes get an `id` derived from `slug`-collected
// keys (the editor maintains the same slug map via `collectHeadings`),
// so `/page#anchor` deep links keep working through the migration.
//
// **Why a single file?** Splitting per-block components into
// `components/<type>.tsx` would multiply imports, force barrel files,
// and rerun `@portabletext/react`'s map merge on every render. Keeping
// it inline keeps the renderer one-pass with no barrel risk
// (AGENTS.md `bundle-barrel-imports`).

export interface PortableTextBodyProps {
  body: PortableTextBodyType
  /** Optional thumbhash hydration map. Mirrors the MDX `<PageBody>` prop. */
  imageMeta?: ImageMetaMap
  /**
   * Precomputed heading anchor IDs, in the order this body's heading
   * blocks appear. SSR loaders pass `collectHeadings(body, deriveSlug)
   * .map(h => h.slug)` so anchors line up with the canonical pinyin
   * pipeline (and stay byte-identical to the MDX `rehype-slug` output
   * for ASCII headings).
   *
   * When omitted (e.g. editor live-preview before the
   * server round-trip), the renderer falls back to a local
   * `github-slugger` pass over the raw text — the anchor still
   * disambiguates duplicates, but Han-only headings degrade to the
   * historical CJK-as-is slug instead of pinyin. The full SSR path
   * always supplies this prop, so the fallback is editor-only.
   */
  headingSlugs?: readonly string[]
}

// React context fan-out for footnote definitions. Every renderer
// component reads what it needs through this context instead of the
// previous "RenderCtx" prop drilling, which doesn't compose with the
// `@portabletext/react` component map (the library only passes the
// node + its index to each component).

interface FootnoteRefCtx {
  definitions: ReadonlyMap<string, FootnoteDefinitionBlock>
}
const FootnoteRefContext = createContext<FootnoteRefCtx>({ definitions: new Map() })

// Heading anchor IDs come from one of two channels:
//
//   1. **Precomputed** (preferred). The SSR loader runs
//      `collectHeadings(body, deriveSlug)` and threads the slug
//      list down via the `headingSlugs` prop. The heading
//      components consume the next slug from a per-render cursor.
//      This is the only path that yields pinyin-pro-aware anchors
//      for Han-text headings, because `pinyin-pro` is a server-only
//      dependency (the bundle is too heavy for the client).
//   2. **Local fallback**. When `headingSlugs` is absent (editor
//      live-preview, snapshot tests with bare bodies), we run a
//      local `github-slugger` over the raw text. CJK headings keep
//      their historical (CJK-as-is) slug, ASCII headings stay
//      byte-identical with the SSR path.
//
// Either way the cursor / slugger is reset per render via the
// `body` identity dependency.
interface HeadingAnchorCtx {
  precomputed: readonly string[] | undefined
  cursor: { i: number }
  fallback: GithubSlugger
}
const HeadingAnchorContext = createContext<HeadingAnchorCtx>({
  precomputed: undefined,
  cursor: { i: 0 },
  fallback: new GithubSlugger(),
})

export function PortableTextBody({ body, imageMeta, headingSlugs }: PortableTextBodyProps) {
  const footnoteCtx = useMemo<FootnoteRefCtx>(() => ({ definitions: collectFootnoteDefinitions(body) }), [body])
  // Reset cursor + slugger whenever the body OR the precomputed
  // slug list changes. The cursor / slugger are stateful by design
  // (each heading consumes one entry / runs `slug()` once), so we
  // need a fresh instance per render to keep anchors stable across
  // re-renders of the same body. We list `body` explicitly even
  // though we don't read it inside the initialiser — its identity
  // change is the trigger we want.
  const headingCtx = useMemo<HeadingAnchorCtx>(
    () => ({ precomputed: headingSlugs, cursor: { i: 0 }, fallback: new GithubSlugger() }),
    // oxlint-disable-next-line exhaustive-deps
    [body, headingSlugs],
  )

  // Footnote definitions (block type `footnoteDefinition`) are
  // rendered together at the bottom of the body — never inline —
  // matching the GFM `<section data-footnotes>` convention.
  const inlineBody = useMemo(() => body.filter((block) => block._type !== 'footnoteDefinition'), [body])
  const footnotes = useMemo(
    () => body.filter((block): block is FootnoteDefinitionBlock => block._type === 'footnoteDefinition'),
    [body],
  )

  return (
    <ImageMetaProvider value={imageMeta}>
      <FootnoteProvider>
        <FootnoteRefContext.Provider value={footnoteCtx}>
          <HeadingAnchorContext.Provider value={headingCtx}>
            <div className="portable-text-body">
              <PortableText value={inlineBody as never} components={portableTextComponents} />
              {footnotes.length > 0 ? <FootnotesSection definitions={footnotes} /> : null}
            </div>
          </HeadingAnchorContext.Provider>
        </FootnoteRefContext.Provider>
      </FootnoteProvider>
    </ImageMetaProvider>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFootnoteDefinitions(body: PortableTextBodyType): Map<string, FootnoteDefinitionBlock> {
  const out = new Map<string, FootnoteDefinitionBlock>()
  for (const block of body) {
    if (block._type === 'footnoteDefinition') {
      out.set(block._key, block)
    }
  }
  return out
}

// Resolve a heading anchor id. Reads from the cursor when SSR
// supplied a precomputed slug list (the canonical pinyin pipeline);
// falls back to a local `github-slugger` over the raw text when the
// list is absent (editor preview before round-tripping through the
// server). A stale cursor (more headings rendered than the loader
// declared) silently degrades to the fallback so a mid-edit body
// with an extra heading still renders.
function anchorIdFor(text: string, ctx: HeadingAnchorCtx): string {
  if (ctx.precomputed !== undefined) {
    const slug = ctx.precomputed[ctx.cursor.i]
    ctx.cursor.i += 1
    if (typeof slug === 'string' && slug.length > 0) {
      return slug
    }
  }
  return ctx.fallback.slug(text)
}

function nodeText(node: ReactNode): string {
  // The block component receives the rendered children; we need the
  // raw text to compute anchor ids. Walk the React node tree pulling
  // out plain strings/numbers — works for the simple text + decorator
  // shapes that appear in headings.
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join('')
  }
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return nodeText(props?.children)
  }
  return ''
}

// ---------------------------------------------------------------------------
// PortableText component map
// ---------------------------------------------------------------------------

function Heading1({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingAnchorContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx)
  return <h1 id={id}>{children}</h1>
}
function Heading2({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingAnchorContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx)
  return <h2 id={id}>{children}</h2>
}
function Heading3({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingAnchorContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx)
  return <h3 id={id}>{children}</h3>
}
function Heading4({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingAnchorContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx)
  return <h4 id={id}>{children}</h4>
}
function ParagraphBlock({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}
function BlockquoteBlock({ children }: { children: ReactNode }) {
  return <blockquote>{children}</blockquote>
}

const portableTextComponents: PortableTextComponents = {
  block: {
    h1: ({ children }) => <Heading1>{children}</Heading1>,
    h2: ({ children }) => <Heading2>{children}</Heading2>,
    h3: ({ children }) => <Heading3>{children}</Heading3>,
    h4: ({ children }) => <Heading4>{children}</Heading4>,
    normal: ({ children }) => <ParagraphBlock>{children}</ParagraphBlock>,
    blockquote: ({ children }) => <BlockquoteBlock>{children}</BlockquoteBlock>,
  },
  // `@portabletext/react` collapses consecutive list items sharing the
  // same `listItem` + `level` into a single `<ul>` / `<ol>` for us;
  // we just declare the wrapper. Nested lists are handled because the
  // bridge writes higher-level items into `level: 2 / 3 / …` — the
  // toolkit nests them automatically when `listNestingMode` is the
  // default `html`.
  list: {
    bullet: ({ children }) => <ul>{children}</ul>,
    number: ({ children }) => <ol>{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong>{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    underline: ({ children }) => <u>{children}</u>,
    'strike-through': ({ children }) => <s>{children}</s>,
    code: ({ children }) => <code>{children}</code>,
    link: LinkMark,
    mathInline: MathInlineMarkRenderer,
    footnoteRef: FootnoteRefMarkRenderer,
  },
  types: {
    image: ImageBlockComponent,
    code: CodeBlockNodeComponent,
    mathBlock: MathBlockComponent,
    mermaid: MermaidBlockComponent,
    horizontalRule: HorizontalRuleComponent,
    musicPlayer: MusicPlayerComponent,
    solution: SolutionBlockComponent,
    table: TableBlockComponent,
  },
  hardBreak: () => <br />,
  unknownType: ({ value }) => {
    if (typeof console !== 'undefined') {
      console.warn('[PortableTextBody] unknown block type:', (value as { _type?: string })._type)
    }
    return null
  },
  unknownMark: ({ children, markType }) => {
    if (typeof console !== 'undefined') {
      console.warn('[PortableTextBody] unknown mark type:', markType)
    }
    return <>{children}</>
  },
  unknownBlockStyle: ({ children, value }) => {
    if (typeof console !== 'undefined') {
      console.warn('[PortableTextBody] unknown block style:', (value as { style?: string }).style)
    }
    return <p>{children}</p>
  },
  unknownList: ({ children }) => <ul>{children}</ul>,
  unknownListItem: ({ children }) => <li>{children}</li>,
}

// --- Mark renderers ---------------------------------------------------------

function LinkMark({ value, children }: PortableTextMarkComponentProps<LinkMarkDef>) {
  const def = value
  if (def === undefined) {
    return <>{children}</>
  }
  return (
    <a href={def.href} rel={def.rel} target={def.target}>
      {children}
    </a>
  )
}

function MathInlineMarkRenderer({ value }: PortableTextMarkComponentProps<MathInlineMarkDef>) {
  const def = value
  if (def === undefined) {
    return null
  }
  if (def.svg !== undefined && def.svg !== '') {
    return <span className="math-inline" dangerouslySetInnerHTML={{ __html: def.svg }} />
  }
  return <code className="math-inline">{def.tex}</code>
}

function FootnoteRefMarkRenderer({ value }: PortableTextMarkComponentProps<FootnoteRefMarkDef>) {
  const def = value
  if (def === undefined) {
    return null
  }
  return (
    <sup id={`user-content-fnref-${def.index}`} data-footnote-ref="">
      <a href={`#user-content-fn-${def.index}`} className="footnote-ref">
        {def.index}
      </a>
    </sup>
  )
}

// --- Custom-block renderers -------------------------------------------------

function ImageBlockComponent({ value }: PortableTextTypeComponentProps<ImageBlock>) {
  return (
    <figure>
      <MdxImg
        src={value.src}
        alt={value.alt ?? ''}
        width={value.width}
        height={value.height}
        data-thumbhash={value.thumbhash}
      />
      {value.caption !== undefined && value.caption !== '' ? <figcaption>{value.caption}</figcaption> : null}
    </figure>
  )
}

function CodeBlockNodeComponent({ value }: PortableTextTypeComponentProps<CodeBlock>) {
  if (value.highlightedHtml !== undefined && value.highlightedHtml !== '') {
    return (
      <CodeBlockComponent
        className={value.language !== undefined ? `language-${value.language}` : undefined}
        data-language={value.language}
        dangerouslySetInnerHTML={{ __html: value.highlightedHtml }}
      />
    )
  }
  return (
    <CodeBlockComponent>
      <code
        className={value.language !== undefined ? `language-${value.language}` : undefined}
        data-language={value.language}
      >
        {value.code}
      </code>
    </CodeBlockComponent>
  )
}

function MathBlockComponent({ value }: PortableTextTypeComponentProps<MathBlock>) {
  if (value.svg !== undefined && value.svg !== '') {
    return <div className="math math-display" dangerouslySetInnerHTML={{ __html: value.svg }} />
  }
  return (
    <pre className="math math-display">
      <code>{value.tex}</code>
    </pre>
  )
}

function MermaidBlockComponent({ value }: PortableTextTypeComponentProps<MermaidBlock>) {
  if (value.svg !== undefined && value.svg !== '') {
    return <div className="mermaid" dangerouslySetInnerHTML={{ __html: value.svg }} />
  }
  return <pre className="mermaid">{value.code}</pre>
}

function HorizontalRuleComponent(_props: PortableTextTypeComponentProps<HorizontalRuleBlock>) {
  return <hr />
}

function MusicPlayerComponent({ value }: PortableTextTypeComponentProps<MusicPlayerBlock>) {
  return <MusicPlayer id={value.playerId} auto={value.auto} center={value.center} />
}

function SolutionBlockComponent({ value }: PortableTextTypeComponentProps<SolutionBlock>) {
  // Solution children are themselves a (one-deep) PortableText body.
  // Recurse through `<PortableText>` so list-folding etc. continue to
  // work inside the solution wrapper.
  return (
    <Solution>
      <PortableText value={value.children as never} components={portableTextComponents} />
    </Solution>
  )
}

function TableBlockComponent({ value }: PortableTextTypeComponentProps<TableBlock>) {
  const rows = value.rows ?? []
  const hasHeader = value.hasHeaderRow ?? false
  const headRows = hasHeader ? rows.slice(0, 1) : []
  const bodyRows = hasHeader ? rows.slice(1) : rows
  return (
    <div className="pt-table-wrapper overflow-x-auto">
      <table className="pt-table">
        {headRows.length > 0 ? (
          <thead>
            {headRows.map((row) => (
              <tr key={row._key}>
                {row.cells.map((cell) => (
                  <th key={cell._key}>{renderSpansInline(cell.content, cell.markDefs ?? [])}</th>
                ))}
              </tr>
            ))}
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map((row) => (
            <tr key={row._key}>
              {row.cells.map((cell) => {
                const Tag = cell.isHeader === true ? 'th' : 'td'
                return <Tag key={cell._key}>{renderSpansInline(cell.content, cell.markDefs ?? [])}</Tag>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Render a flat span list (with an outer markDefs registry) without
// going through `<PortableText>` itself — table cells are NOT block
// arrays in our dialect (they only carry inline spans + mark defs),
// so wrapping them in a virtual block just to feed them back through
// the toolkit would be wasteful and would also force a `<p>` wrapper.
function renderSpansInline(spans: readonly Span[], markDefs: readonly MarkDef[]): ReactNode {
  return spans.map((span) => <SpanInline key={span._key} span={span} markDefs={markDefs} />)
}

function SpanInline({ span, markDefs }: { span: Span; markDefs: readonly MarkDef[] }) {
  const marks = span.marks ?? []
  if (marks.length === 0) {
    return <>{span.text}</>
  }
  // Wrap innermost-out so the last mark name becomes the outermost
  // wrapper, matching the toolkit's mark stacking semantics.
  let node: ReactNode = span.text
  for (const markName of marks) {
    node = applyInlineMark(node, markName, markDefs)
  }
  return <>{node}</>
}

function applyInlineMark(node: ReactNode, markName: string, markDefs: readonly MarkDef[]): ReactNode {
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
  const def = markDefs.find((entry) => entry._key === markName)
  if (def === undefined) {
    return node
  }
  switch (def._type) {
    case 'link':
      return (
        <a href={def.href} rel={def.rel} target={def.target}>
          {node}
        </a>
      )
    case 'mathInline':
      if (def.svg !== undefined && def.svg !== '') {
        return <span className="math-inline" dangerouslySetInnerHTML={{ __html: def.svg }} />
      }
      return <code className="math-inline">{def.tex}</code>
    case 'footnoteRef':
      return (
        <sup id={`user-content-fnref-${def.index}`} data-footnote-ref="">
          <a href={`#user-content-fn-${def.index}`} className="footnote-ref">
            {def.index}
          </a>
        </sup>
      )
  }
}

// --- Footnotes section ------------------------------------------------------

function FootnotesSection({ definitions }: { definitions: readonly FootnoteDefinitionBlock[] }) {
  return (
    <section className="footnotes" data-footnotes="">
      <h2 className="sr-only" id="footnote-label">
        Footnotes
      </h2>
      <ol>
        {definitions.map((definition) => (
          <li key={definition._key} id={`user-content-fn-${definition.index}`}>
            <PortableText value={definition.children as never} components={portableTextComponents} />
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
