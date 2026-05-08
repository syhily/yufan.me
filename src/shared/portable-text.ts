import { z } from 'zod'

// PortableText dialect for this repository. Storing PortableText in
// `content.body` (`jsonb`) lets the editor reuse the well-trodden PT
// surface (Tiptap's ProseMirror schema converts to/from PT cleanly,
// the `@portabletext/react` SSR renderer is plug-and-play, and a future
// post migration can reuse the same shape) while still expressing every
// MDX construct the existing posts/pages depend on.
//
// The dialect is intentionally a *strict subset* of the upstream PT
// spec: we keep the `_type: 'block' | 'span'` core verbatim, the
// standard inline marks (`strong`, `em`, `underline`, `code`,
// `strike-through`), `link` markDefs, and the canonical block styles
// (`normal` / `h1`-`h4` / `blockquote`); on top of that we add a
// hand-picked set of custom block types (`image`, `code`, `mathBlock`,
// `mermaid`, `horizontalRule`, `musicPlayer`, `solution`, `friends`)
// and two custom inline marks (`mathInline`, `footnoteRef`) that
// each map 1:1 onto an existing MDX-side React component.
//
// **Why not store ProseMirror JSON directly?**
//   - PT is editor-agnostic: a future migration off Tiptap (StackEdit,
//     a server-side LLM transformer, …) doesn't reshape every row.
//   - PT is much easier to validate at the API perimeter — flat block
//     arrays vs. recursive PM trees of arbitrary depth.
//   - PT's `markDefs` carry rich link/annotation metadata while leaving
//     the inline span text reflowable, which preserves text searchability.
//
// **Why a strict subset instead of arbitrary `_type`?**
//   - Keeping the type union closed gives the SSR renderer
//     (PortableTextBody UI component) and the Tiptap bridge
//     (page-editor pt-bridge module) a finite switch to drive.
//   - The Zod schema `portableTextBodySchema` rejects unknown payloads
//     before they land in `content.body`, so downgrading the renderer
//     after a future spec extension never produces "unrenderable"
//     revisions in the wild.
//
// All ids (`_key`) are server-generated nanoids in the editor save
// path; the schema only checks they're non-empty strings (the editor
// state machine owns uniqueness within a revision).

const NON_EMPTY_KEY = z.string().min(1)

// --- Standard inline marks ---------------------------------------------------

// Closed set of *decorator* marks (i.e. inline format toggles that
// don't carry data — the inline `code` is just a span style, not a
// reference into `markDefs`). The `mathInline` and `footnoteRef`
// "marks" actually live in `markDefs` because they need a payload, but
// they appear inside `span.marks` as the corresponding `_key`.
export const STANDARD_DECORATORS = ['strong', 'em', 'underline', 'code', 'strike-through'] as const
export type StandardDecorator = (typeof STANDARD_DECORATORS)[number]

// --- Standard block styles ---------------------------------------------------

// Closed set of paragraph/heading styles. We support h1-h4 because the
// Markdown corpus only ever uses up to four levels (the SEO / TOC code
// would mis-render h5/h6 anyway). `blockquote` covers GFM blockquotes
// and the editor's `<` / `> ` shortcuts; the `solution` blockquote
// variant is its *own* `_type: 'solution'` block, not a style.
export const STANDARD_BLOCK_STYLES = ['normal', 'h1', 'h2', 'h3', 'h4', 'blockquote'] as const
export type StandardBlockStyle = (typeof STANDARD_BLOCK_STYLES)[number]

export const STANDARD_LIST_ITEMS = ['bullet', 'number'] as const
export type StandardListItem = (typeof STANDARD_LIST_ITEMS)[number]

// --- Custom mark definitions (markDefs entries) ------------------------------

// `link` is the upstream PT canonical mark — the editor lifts a
// selection's URL into `markDefs[i] = { _type: 'link', _key, href }`
// and references it by `_key` in `span.marks`. We add `rel`/`target`
// so external-link rules (`rel="nofollow noreferrer"`,
// `target="_blank"`) saved at editor time round-trip into the SSR
// output without re-running `rehype-external-links`.
export const linkMarkDefSchema = z.object({
  _type: z.literal('link'),
  _key: NON_EMPTY_KEY,
  href: z.string(),
  rel: z.string().optional(),
  target: z.string().optional(),
})
export type LinkMarkDef = z.infer<typeof linkMarkDefSchema>

// `mathInline` payload is a TeX expression (already validated by the
// editor) plus the pre-rendered SVG produced server-side at save time
// (so SSR doesn't re-run MathJax for every public render). The SVG is
// the canonical render; clients without JS still get pretty math.
export const mathInlineMarkDefSchema = z.object({
  _type: z.literal('mathInline'),
  _key: NON_EMPTY_KEY,
  tex: z.string(),
  svg: z.string().optional(),
})
export type MathInlineMarkDef = z.infer<typeof mathInlineMarkDefSchema>

// `footnoteRef` matches `<sup>` in the historical MDX. The `targetKey`
// is the `_key` of the `footnoteDefinition` block this reference
// points at, so the SSR renderer can resolve a hover preview without
// scanning the entire body.
export const footnoteRefMarkDefSchema = z.object({
  _type: z.literal('footnoteRef'),
  _key: NON_EMPTY_KEY,
  targetKey: NON_EMPTY_KEY,
  /** Display index (1, 2, 3, …) — pre-computed at save time. */
  index: z.number().int().min(1),
})
export type FootnoteRefMarkDef = z.infer<typeof footnoteRefMarkDefSchema>

export const markDefSchema = z.discriminatedUnion('_type', [
  linkMarkDefSchema,
  mathInlineMarkDefSchema,
  footnoteRefMarkDefSchema,
])
export type MarkDef = z.infer<typeof markDefSchema>

// --- Span (inline run) -------------------------------------------------------

// `marks` strings are either standard decorator names or `markDef._key`
// references — the union is intentionally `string` (not the Zod-tight
// enum) because the editor and the SSR renderer cross-check them
// against the surrounding `markDefs[]` at runtime. Validating the
// reference graph in Zod would force every span schema to know the
// outer block, blowing up the type definition with no real safety win.
export const spanSchema = z.object({
  _type: z.literal('span'),
  _key: NON_EMPTY_KEY,
  text: z.string(),
  marks: z.array(z.string()).optional(),
})
export type Span = z.infer<typeof spanSchema>

// --- Standard text block -----------------------------------------------------

export const textBlockSchema = z.object({
  _type: z.literal('block'),
  _key: NON_EMPTY_KEY,
  style: z.enum(STANDARD_BLOCK_STYLES).optional(),
  listItem: z.enum(STANDARD_LIST_ITEMS).optional(),
  level: z.number().int().min(1).max(6).optional(),
  children: z.array(spanSchema),
  markDefs: z.array(markDefSchema).optional(),
})
export type TextBlock = z.infer<typeof textBlockSchema>

// --- Custom block types -----------------------------------------------------

// Image block. `assetSrc` is the resolved public URL (matches the
// historical MDX `<img src="…">`) so the SSR renderer doesn't have to
// resolve an asset reference on the hot path; the optional
// `imagePath` is the S3 storagePath this row references, which the
// `image_sources` projection on `content` writes out for the
// thumbhash-resolution enhancer.
export const imageBlockSchema = z.object({
  _type: z.literal('image'),
  _key: NON_EMPTY_KEY,
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  thumbhash: z.string().optional(),
  /** When the asset is stored in our S3 bucket, the canonical key. */
  storagePath: z.string().optional(),
})
export type ImageBlock = z.infer<typeof imageBlockSchema>

// Code block. `code` is the raw text; `language` is the user-selected
// language slug (matches `<pre data-language="…">` produced by
// `rehype-code`). `highlightedHtml` is the pre-rendered Shiki HTML
// produced server-side at save time so SSR public renders don't
// re-tokenise the code on every request.
export const codeBlockSchema = z.object({
  _type: z.literal('code'),
  _key: NON_EMPTY_KEY,
  code: z.string(),
  language: z.string().optional(),
  highlightedHtml: z.string().optional(),
})
export type CodeBlock = z.infer<typeof codeBlockSchema>

// Block-level math. `tex` is the raw TeX, `svg` is the MathJax-rendered
// SVG (saved alongside so SSR doesn't depend on MathJax at request
// time). Inline math lives in `mathInlineMarkDef`.
export const mathBlockSchema = z.object({
  _type: z.literal('mathBlock'),
  _key: NON_EMPTY_KEY,
  tex: z.string(),
  svg: z.string().optional(),
})
export type MathBlock = z.infer<typeof mathBlockSchema>

// Mermaid diagram. `code` is the raw mermaid source, `svg` is the
// pre-rendered SVG saved at editor save time. Mermaid is heavy
// (Puppeteer / mermaid-cli on the server) so we *strongly prefer* the
// pre-rendered svg; the renderer falls back to a `<pre>` placeholder
// when it's missing.
export const mermaidBlockSchema = z.object({
  _type: z.literal('mermaid'),
  _key: NON_EMPTY_KEY,
  code: z.string(),
  svg: z.string().optional(),
})
export type MermaidBlock = z.infer<typeof mermaidBlockSchema>

// Horizontal rule (`---` / `<hr>`).
export const horizontalRuleBlockSchema = z.object({
  _type: z.literal('horizontalRule'),
  _key: NON_EMPTY_KEY,
})
export type HorizontalRuleBlock = z.infer<typeof horizontalRuleBlockSchema>

// `<MusicPlayer id="…" auto={…} center={…} />` from the music MDX
// component.
// Stores only the metadata MDX accepted; the public renderer hands it
// to the same React component as today.
export const musicPlayerBlockSchema = z.object({
  _type: z.literal('musicPlayer'),
  _key: NON_EMPTY_KEY,
  /** 16-char `[a-z0-9]` opaque handle from `music.player_id`. */
  playerId: z.string().min(1),
  auto: z.boolean().optional(),
  center: z.boolean().optional(),
})
export type MusicPlayerBlock = z.infer<typeof musicPlayerBlockSchema>

// `<Friends />` grid renderer (the page-side Friends MDX component). Friends
// data isn't stored in the body (it's owned by the `friend` Postgres
// table); the block is purely a "render `<Friends />` here" marker.
export const friendsBlockSchema = z.object({
  _type: z.literal('friends'),
  _key: NON_EMPTY_KEY,
})
export type FriendsBlock = z.infer<typeof friendsBlockSchema>

// `<Solution>` blockquote-with-flourish (the solutions MDX component).
// The `children` field is a nested PortableText body (text blocks,
// images, code, etc.) so the solution can hold the same set of
// constructs as the page itself. Note: a solution **cannot** nest
// another solution or another footnote definition — the editor never
// surfaces those as slash commands inside a solution body, and this
// flat schema avoids unbounded recursion in both Zod and the SSR
// renderer.
export type SolutionBlock = {
  _type: 'solution'
  _key: string
  children: NonRecursiveBlock[]
}

// `<li id="user-content-fn-N">` GFM footnote definition. Held as a
// dedicated block so the SSR renderer can collect them at the bottom
// of the body without inferring "this is a footnote" from heading
// patterns. `index` is the human-visible footnote number (1, 2, 3…).
// Same flat-recursion rule as `solution`: footnote definitions can't
// nest other footnote definitions or solutions.
export type FootnoteDefinitionBlock = {
  _type: 'footnoteDefinition'
  _key: string
  index: number
  children: NonRecursiveBlock[]
}

/** Subset of `Block` that's allowed inside `solution.children` /
 *  `footnoteDefinition.children`. Same as `Block` minus the recursive
 *  variants; declared as its own union so the recursion stays
 *  one-deep and Zod's discriminated union doesn't choke on the cycle. */
export type NonRecursiveBlock =
  | TextBlock
  | ImageBlock
  | CodeBlock
  | MathBlock
  | MermaidBlock
  | HorizontalRuleBlock
  | MusicPlayerBlock
  | FriendsBlock

const nonRecursiveBlockSchema = z.discriminatedUnion('_type', [
  textBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
  mathBlockSchema,
  mermaidBlockSchema,
  horizontalRuleBlockSchema,
  musicPlayerBlockSchema,
  friendsBlockSchema,
])

export const solutionBlockSchema = z.object({
  _type: z.literal('solution'),
  _key: NON_EMPTY_KEY,
  children: z.array(nonRecursiveBlockSchema),
}) satisfies z.ZodType<SolutionBlock>

export const footnoteDefinitionBlockSchema = z.object({
  _type: z.literal('footnoteDefinition'),
  _key: NON_EMPTY_KEY,
  index: z.number().int().min(1),
  children: z.array(nonRecursiveBlockSchema),
}) satisfies z.ZodType<FootnoteDefinitionBlock>

// --- Block discriminated union ----------------------------------------------

export type Block = NonRecursiveBlock | SolutionBlock | FootnoteDefinitionBlock

export const blockSchema = z.discriminatedUnion('_type', [
  textBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
  mathBlockSchema,
  mermaidBlockSchema,
  horizontalRuleBlockSchema,
  musicPlayerBlockSchema,
  solutionBlockSchema,
  friendsBlockSchema,
  footnoteDefinitionBlockSchema,
]) satisfies z.ZodType<Block>

// --- Body --------------------------------------------------------------------

// Top-level body schema applied at every API perimeter (saveDraft,
// publishLatest, previewPage). Empty bodies are valid (a freshly
// created `doc` row without a draft yet has `body=[]`).
export const portableTextBodySchema = z.array(blockSchema)
export type PortableTextBody = z.infer<typeof portableTextBodySchema>

// Convenience aliases: keep call sites readable.
export type PortableTextBlock = Block
export type { Block as PtBlock }

// --- Helpers ----------------------------------------------------------------

/** Return the structured TOC entries this body would render. */
export function collectHeadings(body: PortableTextBody): Array<{ depth: number; text: string; slug?: string }> {
  const headings: Array<{ depth: number; text: string; slug?: string }> = []
  for (const block of body) {
    if (block._type !== 'block') {
      continue
    }
    const style = block.style
    if (style === undefined || style === 'normal' || style === 'blockquote') {
      continue
    }
    const depth = headingDepthFromStyle(style)
    if (depth === null) {
      continue
    }
    const text = block.children
      .map((span) => span.text)
      .join('')
      .trim()
    if (text.length === 0) {
      continue
    }
    headings.push({ depth, text })
  }
  return headings
}

function headingDepthFromStyle(style: StandardBlockStyle): number | null {
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

/** Walk a body and pick out every `image.storagePath` referenced. */
export function collectImageStoragePaths(body: PortableTextBody): string[] {
  const paths = new Set<string>()
  for (const block of body) {
    walkBlockForImages(block, paths)
  }
  return Array.from(paths)
}

function walkBlockForImages(block: Block, sink: Set<string>): void {
  if (block._type === 'image' && typeof block.storagePath === 'string' && block.storagePath !== '') {
    sink.add(block.storagePath)
    return
  }
  if (block._type === 'solution' || block._type === 'footnoteDefinition') {
    for (const child of block.children) {
      walkBlockForImages(child, sink)
    }
  }
}

/** Plain-text projection used by search / RSS summary / OG fallback. */
export function bodyToPlainText(body: PortableTextBody): string {
  const out: string[] = []
  for (const block of body) {
    pushBlockText(block, out)
  }
  return out.join('\n').trim()
}

function pushBlockText(block: Block, out: string[]): void {
  if (block._type === 'block') {
    out.push(block.children.map((span) => span.text).join(''))
    return
  }
  if (block._type === 'code') {
    out.push(block.code)
    return
  }
  if (block._type === 'mathBlock') {
    out.push(block.tex)
    return
  }
  if (block._type === 'image') {
    if (block.alt !== undefined && block.alt !== '') {
      out.push(block.alt)
    }
    return
  }
  if (block._type === 'solution' || block._type === 'footnoteDefinition') {
    for (const child of block.children) {
      pushBlockText(child, out)
    }
  }
}

/**
 * Validate an arbitrary value as a PortableText body. Throws a Zod
 * `ZodError` on failure so the caller can surface field-level errors;
 * use `safeValidatePortableTextBody` if you want a result envelope.
 */
export function validatePortableTextBody(value: unknown): PortableTextBody {
  return portableTextBodySchema.parse(value)
}

export function safeValidatePortableTextBody(
  value: unknown,
): { ok: true; body: PortableTextBody } | { ok: false; error: z.ZodError } {
  const result = portableTextBodySchema.safeParse(value)
  if (result.success) {
    return { ok: true, body: result.data }
  }
  return { ok: false, error: result.error }
}
