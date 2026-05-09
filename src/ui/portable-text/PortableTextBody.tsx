import {
  PortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
  type PortableTextTypeComponentProps,
} from '@portabletext/react'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { Friend } from '@/shared/catalog'
import type {
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
  TableBlock,
} from '@/shared/portable-text'

import { CodeBlock as CodeBlockComponent } from '@/ui/mdx/CodeBlock'
import { FootnoteProvider } from '@/ui/mdx/Footnotes'
import { ImageMetaProvider, type ImageMetaMap } from '@/ui/mdx/image-meta-context'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Friends } from '@/ui/mdx/page/Friends'
import { Solution } from '@/ui/mdx/solutions/Solution'

// SSR/CSR renderer for PortableText. Built on top of `@portabletext/react`'s
// composable component map so the standard text/list/heading/decorator
// pipeline (including consecutive list-item folding) is delegated to the
// official toolkit, while every yufan.me-specific block / mark
// (`image`, `code`, `mathBlock`, `mermaid`, `horizontalRule`,
// `musicPlayer`, `solution`, `friends`, `footnoteDefinition`, `table`,
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
  /** Loader-supplied friends list, consumed by `friends` blocks. */
  friends?: readonly Friend[]
  /** Optional thumbhash hydration map. Mirrors the MDX `<PageBody>` prop. */
  imageMeta?: ImageMetaMap
}

// React context fan-out for friends + footnotes. Every renderer component
// reads what it needs through these contexts instead of the previous
// "RenderCtx" prop drilling, which doesn't compose with the
// `@portabletext/react` component map (the library only passes the
// node + its index to each component).

interface FriendsCtx {
  friends: readonly Friend[]
}
const FriendsContext = createContext<FriendsCtx>({ friends: [] })

interface FootnoteRefCtx {
  definitions: ReadonlyMap<string, FootnoteDefinitionBlock>
}
const FootnoteRefContext = createContext<FootnoteRefCtx>({ definitions: new Map() })

// Heading anchor IDs disambiguate against earlier headings in the same
// body. We track that through a context whose value is mutated as the
// renderer walks blocks — the alternative (computing slugs upfront via
// `collectHeadings` then keying into them) would require knowing the
// block index at render time, which `@portabletext/react` does pass
// (`PortableTextComponentProps.index`), but a stateful tracker keeps
// the API surface smaller and matches GitHub-slugger semantics that
// rehype-slug uses on the historical MDX path.
interface HeadingIndexCtx {
  index: Map<string, number>
}
const HeadingIndexContext = createContext<HeadingIndexCtx>({ index: new Map() })

export function PortableTextBody({ body, friends, imageMeta }: PortableTextBodyProps) {
  const friendsCtx = useMemo<FriendsCtx>(() => ({ friends: friends ?? [] }), [friends])
  const footnoteCtx = useMemo<FootnoteRefCtx>(() => ({ definitions: collectFootnoteDefinitions(body) }), [body])
  // A fresh heading-index map per render so anchor ids are stable
  // across renders that share the same body. The map is identity-
  // bound to the `body` value, so listing it as a dependency is
  // intentional even though we don't read from it inside the
  // initializer.
  // oxlint-disable-next-line exhaustive-deps
  const headingCtx = useMemo<HeadingIndexCtx>(() => ({ index: new Map() }), [body])

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
        <FriendsContext.Provider value={friendsCtx}>
          <FootnoteRefContext.Provider value={footnoteCtx}>
            <HeadingIndexContext.Provider value={headingCtx}>
              <div className="portable-text-body">
                <PortableText value={inlineBody as never} components={portableTextComponents} />
                {footnotes.length > 0 ? <FootnotesSection definitions={footnotes} /> : null}
              </div>
            </HeadingIndexContext.Provider>
          </FootnoteRefContext.Provider>
        </FriendsContext.Provider>
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

function anchorIdFor(text: string, index: Map<string, number>): string {
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
  const seen = index.get(base) ?? 0
  index.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen}`
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
  const ctx = useContext(HeadingIndexContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx.index)
  return <h1 id={id}>{children}</h1>
}
function Heading2({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingIndexContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx.index)
  return <h2 id={id}>{children}</h2>
}
function Heading3({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingIndexContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx.index)
  return <h3 id={id}>{children}</h3>
}
function Heading4({ children }: { children: ReactNode }) {
  const ctx = useContext(HeadingIndexContext)
  const id = anchorIdFor(nodeText(children).trim(), ctx.index)
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
    friends: FriendsBlockComponent,
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

function FriendsBlockComponent(_props: PortableTextTypeComponentProps<FriendsBlock>) {
  const ctx = useContext(FriendsContext)
  return <Friends friends={[...ctx.friends]} />
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
