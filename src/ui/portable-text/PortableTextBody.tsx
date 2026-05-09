import {
  PortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
  type PortableTextTypeComponentProps,
} from '@portabletext/react'
import GithubSlugger from 'github-slugger'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  collectHeadingSlotsInPortableTextRenderOrder,
  type CodeBlock,
  type FootnoteDefinitionBlock,
  type FootnoteRefMarkDef,
  type HorizontalRuleBlock,
  type ImageBlock,
  type ImageBlockLayout,
  type LinkMarkDef,
  type MarkDef,
  type MathBlock,
  type MathInlineMarkDef,
  type MermaidBlock,
  type MusicPlayerBlock,
  type NonRecursiveBlock,
  type PortableTextBody as PortableTextBodyType,
  type SolutionBlock,
  type Span,
  type TableBlock,
  type TextBlock,
  type TwoColumnBlock,
} from '@/shared/portable-text'
import { cn } from '@/ui/lib/cn'
import { CodeBlock as CodeBlockComponent } from '@/ui/mdx/CodeBlock'
import { FootnoteProvider, FootnotePreviewRegistrar, FootnoteReference } from '@/ui/mdx/Footnotes'
import { ImageMetaProvider, type ImageMetaMap } from '@/ui/mdx/image-meta-context'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Solution } from '@/ui/mdx/solutions/Solution'

// Decorator marks carry their own Tailwind classes so inline emphasis stays
// visible even when `.prose` typography rules lose the cascade (shadcn
// `text-*` inheritance, nested shells, or `post-content` rules not applying).
const PT_INLINE = {
  strong: 'font-semibold text-ink-strong',
  em: 'italic',
  underline: 'underline underline-offset-2',
  strike: 'line-through text-ink-secondary',
  code: 'rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.875em] text-ink-secondary',
  link: 'text-brand underline decoration-brand/40 underline-offset-2',
  mathTex: 'math-inline rounded bg-muted/50 px-0.5 font-mono text-ink-secondary',
} as const

// SSR/CSR renderer for PortableText. Built on top of `@portabletext/react`'s
// composable component map so the standard text/list/heading/decorator
// pipeline (including consecutive list-item folding) is delegated to the
// official toolkit, while every yufan.me-specific block / mark
// (`image`, `code`, `mathBlock`, `mermaid`, `horizontalRule`,
// `musicPlayer`, `solution`, `twoColumn`, `footnoteDefinition`, `table`,
// plus `mathInline` / `footnoteRef` mark defs) is handled by an
// inline component declared in this file.
//
// **Component reuse**: every custom block type maps onto an existing
// `@/ui/mdx/*` component so the public site renders bytes-for-bytes
// (modulo whitespace) like a hand-authored MDX page would.
//
// **Anchors**: each heading uses the Portable Text block `_key` to look
// up a stable id. Slots are collected with
// `collectHeadingSlotsInPortableTextRenderOrder` (same order as this
// renderer: main column + solution innards + twoColumn (left then right)
// + footnotes). Precomputed
// slugs from the loader zip by index; any gap uses `github-slugger`
// over the saved **plain** heading text — never `react` children, so
// SSR and hydration cannot disagree when a heading wraps marks or
// decorators.
//
// **Why a single file?** Splitting per-block components into
// `components/<type>.tsx` would multiply imports, force barrel files,
// and rerun `@portabletext/react`'s map merge on every render. Keeping
// it inline keeps the renderer one-pass with no barrel risk
// (AGENTS.md `bundle-barrel-imports`).

export interface PortableTextBodyProps {
  body: PortableTextBodyType
  /** Optional thumbhash hydration map. Mirrors the MDX `<PostBody>` prop. */
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
  /**
   * When true, every `musicPlayer` block renders with autoplay forced
   * off so admin surfaces (live preview pane, SSR preview HTML) stay
   * silent while still honouring `center` for layout.
   */
  suppressMusicAutoplay?: boolean
  /** Visible `<h3>` above the footnotes list; defaults to 「尾声礼记」 when omitted. */
  footnotesSectionTitle?: string
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

const EMPTY_HEADING_IDS = new Map<string, string>()

// Heading ids: precomputed slug list (optional) is zipped to
// `collectHeadingSlotsInPortableTextRenderOrder`; each block's `_key`
// maps to its final id. Pure data + pure useMemo — no render-phase
// counters (Strict Mode / parent re-renders cannot desync SSR/CSR).
const HeadingIdByBlockKeyContext = createContext<Map<string, string>>(EMPTY_HEADING_IDS)

interface MusicPresentationCtx {
  suppressAutoplay: boolean
}

const MusicPresentationContext = createContext<MusicPresentationCtx>({ suppressAutoplay: false })

const FOOTNOTES_SECTION_FALLBACK_TITLE = '尾声礼记'

export function PortableTextBody({
  body,
  imageMeta,
  headingSlugs,
  suppressMusicAutoplay,
  footnotesSectionTitle,
}: PortableTextBodyProps) {
  const footnoteCtx = useMemo<FootnoteRefCtx>(() => ({ definitions: collectFootnoteDefinitions(body) }), [body])

  const headingIdByBlockKey = useMemo(() => {
    const slots = collectHeadingSlotsInPortableTextRenderOrder(body)
    const map = new Map<string, string>()
    const fallbackSlugger = new GithubSlugger()
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i]
      const pre = headingSlugs?.[i]
      const id =
        headingSlugs !== undefined && typeof pre === 'string' && pre.length > 0
          ? pre
          : fallbackSlugger.slug(slot.plainText)
      map.set(slot.blockKey, id)
    }
    return map
  }, [body, headingSlugs])

  // Footnote definitions (block type `footnoteDefinition`) are
  // rendered together at the bottom of the body — never inline —
  // matching the GFM `<section data-footnotes>` convention.
  const inlineBody = useMemo(() => body.filter((block) => block._type !== 'footnoteDefinition'), [body])
  const footnotes = useMemo(
    () => body.filter((block): block is FootnoteDefinitionBlock => block._type === 'footnoteDefinition'),
    [body],
  )

  const musicPresentation = useMemo<MusicPresentationCtx>(
    () => ({ suppressAutoplay: suppressMusicAutoplay === true }),
    [suppressMusicAutoplay],
  )

  const resolvedFootnotesHeading =
    footnotesSectionTitle !== undefined && footnotesSectionTitle.trim().length > 0
      ? footnotesSectionTitle.trim()
      : FOOTNOTES_SECTION_FALLBACK_TITLE

  return (
    <ImageMetaProvider value={imageMeta}>
      <MusicPresentationContext.Provider value={musicPresentation}>
        <FootnoteProvider>
          <FootnoteRefContext.Provider value={footnoteCtx}>
            <HeadingIdByBlockKeyContext.Provider value={headingIdByBlockKey}>
              <div className="portable-text-body">
                <PortableText value={inlineBody as never} components={portableTextComponents} />
                {footnotes.length > 0 ? (
                  <FootnotesSection definitions={footnotes} sectionTitle={resolvedFootnotesHeading} />
                ) : null}
              </div>
            </HeadingIdByBlockKeyContext.Provider>
          </FootnoteRefContext.Provider>
        </FootnoteProvider>
      </MusicPresentationContext.Provider>
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

// ---------------------------------------------------------------------------
// PortableText component map
// ---------------------------------------------------------------------------

function HeadingBlock({
  children,
  value,
  Tag,
}: {
  children?: ReactNode
  value: TextBlock
  Tag: 'h1' | 'h2' | 'h3' | 'h4'
}) {
  const ids = useContext(HeadingIdByBlockKeyContext)
  const id = ids.get(value._key) ?? ''
  return <Tag id={id}>{children}</Tag>
}
function ParagraphBlock({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}
function BlockquoteBlock({ children }: { children: ReactNode }) {
  return <blockquote>{children}</blockquote>
}

const portableTextComponents: PortableTextComponents = {
  block: {
    h1: ({ children, value }) => (
      <HeadingBlock Tag="h1" value={value as TextBlock}>
        {children}
      </HeadingBlock>
    ),
    h2: ({ children, value }) => (
      <HeadingBlock Tag="h2" value={value as TextBlock}>
        {children}
      </HeadingBlock>
    ),
    h3: ({ children, value }) => (
      <HeadingBlock Tag="h3" value={value as TextBlock}>
        {children}
      </HeadingBlock>
    ),
    h4: ({ children, value }) => (
      <HeadingBlock Tag="h4" value={value as TextBlock}>
        {children}
      </HeadingBlock>
    ),
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
    strong: ({ children }) => <strong className={PT_INLINE.strong}>{children}</strong>,
    em: ({ children }) => <em className={PT_INLINE.em}>{children}</em>,
    underline: ({ children }) => <u className={PT_INLINE.underline}>{children}</u>,
    'strike-through': ({ children }) => <s className={PT_INLINE.strike}>{children}</s>,
    code: ({ children }) => <code className={PT_INLINE.code}>{children}</code>,
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
    twoColumn: TwoColumnBlockComponent,
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
    <a href={def.href} rel={def.rel} target={def.target} className={PT_INLINE.link}>
      {children}
    </a>
  )
}

function MathInlineMarkRenderer({ value, children }: PortableTextMarkComponentProps<MathInlineMarkDef>) {
  const def = value
  if (def === undefined) {
    return <>{children}</>
  }
  if (def.svg !== undefined && def.svg !== '') {
    return <span className="math-inline inline-block align-middle" dangerouslySetInnerHTML={{ __html: def.svg }} />
  }
  return <code className={cn(PT_INLINE.mathTex, 'inline-block align-middle')}>{def.tex}</code>
}

function FootnoteRefMarkRenderer({ value, children }: PortableTextMarkComponentProps<FootnoteRefMarkDef>) {
  const def = value
  if (def === undefined) {
    return <>{children}</>
  }
  return (
    <FootnoteReference id={`user-content-fnref-${def.index}`} data-footnote-ref="">
      <a href={`#user-content-fn-${def.index}`} className="footnote-ref">
        {def.index}
      </a>
    </FootnoteReference>
  )
}

// --- Custom-block renderers -------------------------------------------------

function imageFigureLayoutClass(layout: ImageBlock['layout']): string {
  const l: ImageBlockLayout = layout ?? 'center'
  return cn(
    'block max-w-full',
    l === 'left' && 'mr-auto ml-0 w-fit',
    l === 'center' && 'mx-auto w-fit',
    l === 'right' && 'mr-0 ml-auto w-fit',
  )
}

function ImageBlockComponent({ value }: PortableTextTypeComponentProps<ImageBlock>) {
  return (
    <figure className={imageFigureLayoutClass(value.layout)}>
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
        copyText={value.code}
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
    // Display MathJax SVG is inline-block; center so gather and align match editor intent.
    return <div className="math math-display text-center" dangerouslySetInnerHTML={{ __html: value.svg }} />
  }
  return (
    <pre className="math math-display">
      <code>{value.tex}</code>
    </pre>
  )
}

function MermaidBlockComponent({ value }: PortableTextTypeComponentProps<MermaidBlock>) {
  const center = value.center === true

  if (value.svg !== undefined && value.svg !== '') {
    const inner = (
      <div className={cn('mermaid', center && '[&_svg]:max-w-none')} dangerouslySetInnerHTML={{ __html: value.svg }} />
    )
    if (!center) {
      return inner
    }
    return <div className="flex max-w-full justify-center overflow-x-auto">{inner}</div>
  }

  const fallback = <pre className="mermaid">{value.code}</pre>
  if (!center) {
    return fallback
  }
  return <div className="flex max-w-full justify-center overflow-x-auto">{fallback}</div>
}

function HorizontalRuleComponent(_props: PortableTextTypeComponentProps<HorizontalRuleBlock>) {
  return <hr />
}

function MusicPlayerComponent({ value }: PortableTextTypeComponentProps<MusicPlayerBlock>) {
  const { suppressAutoplay } = useContext(MusicPresentationContext)
  return (
    <MusicPlayer
      id={value.playerId}
      auto={suppressAutoplay ? false : value.auto === true}
      center={value.center === true}
    />
  )
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

function TwoColumnBlockComponent({ value }: PortableTextTypeComponentProps<TwoColumnBlock>) {
  return (
    <section className="my-6 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8" data-pt-two-column="">
      <div className="min-w-0" data-pt-two-column-pane="" data-side="left">
        <PortableText value={value.left as never} components={portableTextComponents} />
      </div>
      <div className="min-w-0" data-pt-two-column-pane="" data-side="right">
        <PortableText value={value.right as never} components={portableTextComponents} />
      </div>
    </section>
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
      return <strong className={PT_INLINE.strong}>{node}</strong>
    case 'em':
      return <em className={PT_INLINE.em}>{node}</em>
    case 'underline':
      return <u className={PT_INLINE.underline}>{node}</u>
    case 'strike-through':
      return <s className={PT_INLINE.strike}>{node}</s>
    case 'code':
      return <code className={PT_INLINE.code}>{node}</code>
  }
  const def = markDefs.find((entry) => entry._key === markName)
  if (def === undefined) {
    return node
  }
  switch (def._type) {
    case 'link':
      return (
        <a href={def.href} rel={def.rel} target={def.target} className={PT_INLINE.link}>
          {node}
        </a>
      )
    case 'mathInline':
      if (def.svg !== undefined && def.svg !== '') {
        return <span className="math-inline inline-block align-middle" dangerouslySetInnerHTML={{ __html: def.svg }} />
      }
      return <code className={cn(PT_INLINE.mathTex, 'inline-block align-middle')}>{def.tex}</code>
    case 'footnoteRef':
      return (
        <FootnoteReference id={`user-content-fnref-${def.index}`} data-footnote-ref="">
          <a href={`#user-content-fn-${def.index}`} className="footnote-ref">
            {def.index}
          </a>
        </FootnoteReference>
      )
  }
}

// --- Footnotes section ------------------------------------------------------

function lastNormalParagraphKey(children: readonly NonRecursiveBlock[]): string | null {
  for (let i = children.length - 1; i >= 0; i--) {
    const b = children[i]
    if (b._type === 'block' && b.style === 'normal') {
      return b._key
    }
  }
  return null
}

function FootnoteBackrefLink({ footnoteIndex }: { footnoteIndex: number }) {
  return (
    <a
      href={`#user-content-fnref-${footnoteIndex}`}
      data-footnote-backref=""
      aria-label="返回引用"
      className="data-footnote-backref"
    >
      ↩
    </a>
  )
}

function footnotesPortableComponents(lastParagraphKey: string | null, footnoteIndex: number): PortableTextComponents {
  return {
    ...portableTextComponents,
    block: {
      ...portableTextComponents.block,
      normal: ({ children, value }) => {
        const tb = value as TextBlock
        if (lastParagraphKey !== null && tb._key === lastParagraphKey) {
          return (
            <p>
              {children}
              <FootnoteBackrefLink footnoteIndex={footnoteIndex} />
            </p>
          )
        }
        return <ParagraphBlock>{children}</ParagraphBlock>
      },
    },
  } as PortableTextComponents
}

function FootnotesSection({
  definitions,
  sectionTitle,
}: {
  definitions: readonly FootnoteDefinitionBlock[]
  sectionTitle: string
}) {
  return (
    <section className="footnotes" data-footnotes="" aria-labelledby="footnotes-section-heading">
      <h3 id="footnotes-section-heading" className="mt-10 mb-3 scroll-mt-20 text-lg font-semibold text-ink-strong">
        {sectionTitle}
      </h3>
      <ol>
        {definitions.map((definition) => {
          const anchorId = `user-content-fn-${definition.index}`
          const lastPk = lastNormalParagraphKey(definition.children)
          const comps = footnotesPortableComponents(lastPk, definition.index)
          const preview = <PortableText value={definition.children as never} components={portableTextComponents} />
          return (
            <li key={definition._key} id={anchorId}>
              <FootnotePreviewRegistrar anchorId={anchorId} preview={preview} />
              <PortableText value={definition.children as never} components={comps} />
              {lastPk === null ? (
                <p>
                  <FootnoteBackrefLink footnoteIndex={definition.index} />
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
