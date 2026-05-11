import type { Block, MarkDef, PortableTextBody, TextBlock } from '@/shared/pt/schema'

// Server-side pre-renderer for PortableText bodies.
//
// Why: the public SSR PortableText renderer expects pre-rendered
// HTML / MathML / SVG for the heavy custom blocks (`code`, `mathBlock`,
// `mermaid`) and inline marks (`mathInline`). Putting Shiki +
// KaTeX + Mermaid on the request path of every public page render
// would dwarf the actual rendering work — Shiki alone takes 80ms+
// to bootstrap. So we run them once at save / publish time and cache
// the output inside the saved PortableText.
//
// What this does for each block / mark:
//
//   - `code` blocks → fill `highlightedHtml` with Shiki output. We
//     use the same theme + transformer stack as the comment / MDX
//     pipeline so the editor preview, the public site, and the
//     archive feeds all look identical.
//   - `mathBlock` → fill `mathml` with KaTeX-rendered MathML.
//   - `mermaid` → fill `svg` with a beautiful-mermaid-rendered SVG.
//     Renderer is slow on cold start (~500ms), so we run all
//     mermaid blocks in parallel and accept that "save with many
//     diagrams" can take a couple of seconds.
//   - `mathInline` mark defs → fill `mathml` with KaTeX-rendered
//     MathML so the public renderer can drop it straight into the run.
//
// All renderers swallow errors and leave the source field intact.
// The public renderer falls back gracefully — `<pre class="mermaid">`
// for mermaid, raw text for math, plain `<code>` for code blocks —
// so a failed pre-render is never a hard failure.
//
// The top-level entry point `prerenderPortableTextBody()` mutates
// the passed body in place and returns the same reference. Callers
// can pass freshly-validated input from `parseBodyOrThrow` and
// hand the result through to the repository layer unchanged.

export async function prerenderPortableTextBody(body: PortableTextBody): Promise<PortableTextBody> {
  // Collect work first so we can run code / math / mermaid renders
  // in parallel.
  const codeBlocks: { _type: 'code'; _key: string; code: string; language?: string; highlightedHtml?: string }[] = []
  const mathBlocks: { _type: 'mathBlock'; _key: string; tex: string; mathml?: string; svg?: string }[] = []
  const mermaidBlocks: { _type: 'mermaid'; _key: string; code: string; svg?: string }[] = []
  const mathInlineDefs: { _type: 'mathInline'; _key: string; tex: string; mathml?: string; svg?: string }[] = []

  for (const block of body) {
    collectBlock(block, codeBlocks, mathBlocks, mermaidBlocks, mathInlineDefs)
  }

  // Short-circuit if nothing needs pre-rendering — the editor's
  // hot path is "save a draft with no math / code / mermaid" and
  // we'd rather not pay any module-load cost for those saves.
  if (codeBlocks.length === 0 && mathBlocks.length === 0 && mermaidBlocks.length === 0 && mathInlineDefs.length === 0) {
    return body
  }

  await Promise.all([
    runShikiPasses(codeBlocks),
    runKatexPasses(mathBlocks, mathInlineDefs),
    runMermaidPasses(mermaidBlocks),
  ])

  return body
}

// ---------------------------------------------------------------------------
// Block / mark traversal
// ---------------------------------------------------------------------------

function collectBlock(
  block: Block,
  codeBlocks: { _type: 'code'; code: string; language?: string; highlightedHtml?: string }[],
  mathBlocks: { _type: 'mathBlock'; tex: string; mathml?: string; svg?: string }[],
  mermaidBlocks: { _type: 'mermaid'; code: string; svg?: string }[],
  mathInlineDefs: { _type: 'mathInline'; tex: string; mathml?: string; svg?: string }[],
): void {
  switch (block._type) {
    case 'code':
      if (block.code !== '' && (block.highlightedHtml === undefined || block.highlightedHtml === '')) {
        codeBlocks.push(block)
      }
      return
    case 'mathBlock':
      if (block.tex !== '' && (block.mathml === undefined || block.mathml === '')) {
        mathBlocks.push(block)
      }
      return
    case 'mermaid':
      if (block.code !== '' && (block.svg === undefined || block.svg === '')) {
        mermaidBlocks.push(block)
      }
      return
    case 'block': {
      collectFromTextBlock(block, mathInlineDefs)
      return
    }
    case 'solution':
    case 'footnoteDefinition':
      // Recurse into nested children so nested code / math get
      // pre-rendered too.
      if (Array.isArray(block.children)) {
        for (const child of block.children) {
          collectBlock(child as Block, codeBlocks, mathBlocks, mermaidBlocks, mathInlineDefs)
        }
      }
      return
    case 'twoColumn':
      for (const child of block.left) {
        collectBlock(child as Block, codeBlocks, mathBlocks, mermaidBlocks, mathInlineDefs)
      }
      for (const child of block.right) {
        collectBlock(child as Block, codeBlocks, mathBlocks, mermaidBlocks, mathInlineDefs)
      }
      return
    case 'table':
      // Tables only carry inline span content per
      // `tableCellSchema`'s contract — no nested code / math /
      // mermaid blocks, and `mathInline` / `footnoteRef` mark defs
      // are stripped by the bridge before they reach storage. So
      // the prerender pass has no work to do, but we still claim
      // the case explicitly to avoid an "unknown block type"
      // warning if a stricter `default` ever gets added.
      return
    default:
      return
  }
}

function collectFromTextBlock(
  block: TextBlock,
  mathInlineDefs: { _type: 'mathInline'; tex: string; mathml?: string; svg?: string }[],
): void {
  if (!Array.isArray(block.markDefs)) {
    return
  }
  for (const def of block.markDefs as MarkDef[]) {
    if (def._type === 'mathInline' && def.tex !== '' && (def.mathml === undefined || def.mathml === '')) {
      mathInlineDefs.push(def)
    }
  }
}

// ---------------------------------------------------------------------------
// Shiki — code blocks
// ---------------------------------------------------------------------------

async function runShikiPasses(blocks: { code: string; language?: string; highlightedHtml?: string }[]): Promise<void> {
  if (blocks.length === 0) {
    return
  }
  let highlight: ((code: string, lang?: string) => Promise<string>) | null = null
  try {
    const { bundledLanguages, createHighlighter } = await import('shiki')
    const { SHIKI_THEME, shikiTransformers } = await import('@/server/markdown/shiki')
    const highlighter = await createHighlighter({
      langs: Object.keys(bundledLanguages),
      themes: [SHIKI_THEME],
    })
    highlight = (code, lang) =>
      Promise.resolve(
        highlighter.codeToHtml(code, {
          lang: typeof lang === 'string' && lang !== '' && lang in bundledLanguages ? lang : 'text',
          theme: SHIKI_THEME,
          transformers: shikiTransformers(),
        }),
      )
  } catch {
    // Shiki failed to load — leave the blocks raw and let the
    // public renderer's fallback render plain `<pre><code>`.
    return
  }
  await Promise.all(
    blocks.map(async (block) => {
      try {
        block.highlightedHtml = await highlight!(block.code, block.language)
      } catch {
        // Per-block failure: leave `highlightedHtml` unset so the
        // renderer falls back to plain `<code>` for this block only.
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// KaTeX — block + inline math
// ---------------------------------------------------------------------------

async function runKatexPasses(
  blocks: { tex: string; mathml?: string }[],
  inlines: { tex: string; mathml?: string }[],
): Promise<void> {
  if (blocks.length === 0 && inlines.length === 0) {
    return
  }
  // Lazy-loaded process-level singleton. The first math render in a
  // process loads KaTeX; subsequent saves and editor previews re-use it.
  let renderer: import('@/server/markdown/katex-renderer').KatexRenderer
  try {
    const { getKatexRenderer } = await import('@/server/markdown/katex-renderer')
    renderer = await getKatexRenderer()
  } catch {
    return
  }
  for (const block of blocks) {
    try {
      block.mathml = await renderer.render(block.tex, true)
    } catch {
      // Leave mathml unset; renderer will fall back to legacy SVG or raw text.
    }
  }
  for (const def of inlines) {
    try {
      def.mathml = await renderer.render(def.tex, false)
    } catch {
      // Leave mathml unset.
    }
  }
}

// ---------------------------------------------------------------------------
// Mermaid — diagram blocks
// ---------------------------------------------------------------------------

async function runMermaidPasses(blocks: { code: string; svg?: string }[]): Promise<void> {
  if (blocks.length === 0) {
    return
  }
  let renderer: ((code: string) => Promise<string>) | null = null
  try {
    const beautifulMermaid = await import('beautiful-mermaid')
    renderer = (code: string) => beautifulMermaid.renderMermaidSVGAsync(code)
  } catch {
    return
  }
  await Promise.all(
    blocks.map(async (block) => {
      try {
        block.svg = await renderer!(block.code)
      } catch {
        // Leave svg unset; the renderer falls back to a `<pre>`
        // mermaid placeholder so the diagram source is still
        // recoverable.
      }
    }),
  )
}
