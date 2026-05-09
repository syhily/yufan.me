// Single canonical MathJax → SVG renderer for the entire blog. Two
// callers consume it today:
//
//   1. `@/server/cms/pages/prerender` — page save / publish path. Pre-
//      renders every `mathBlock` and `mathInline` in the PortableText
//      body so the public SSR renderer can drop the SVG straight into
//      the run without re-bootstrapping MathJax on every public hit.
//   2. `@/routes/api/actions/admin.renderMath` — editor inline-math
//      preview popover. The admin types TeX and gets back the same
//      MathJax SVG that the prerender pass would produce on save, so
//      WYSIWYG drift between the editor and the published page is
//      structurally impossible.
//
// Keeping a single renderer is critical for the consistency contract
// above. If the editor preview used a different engine (the previous
// code used KaTeX for that path), the operator would see one glyph
// during editing and a different one in production. With both paths
// going through this module, the only divergence possible is across
// MathJax major version upgrades — and those upgrade prerender +
// preview together.
//
// Process-level singleton: building the MathJax engine costs ~100ms
// (loading `AllPackages`, registering the HTML handler, instantiating
// the SVG output jax). The previous prerender code rebuilt it on every
// save; for the editor preview's many-keystroke workload that would be
// a hard latency floor of ~100ms per character. We pin one renderer
// per process via a `Symbol.for` global slot so HMR reloads in dev and
// stray double-imports in production do not spin up parallel engines.
//
// Why we don't unregister the HTML handler: the engine never stops
// being relevant in this process — the next save / preview will need
// it again. Mass-unregistering would also race any concurrent caller
// in the same process. The MathJax docs explicitly support keeping
// one document/handler around for repeated `convert(...)` calls.
//
// Why this lives under `src/server/markdown/`: `mathjax-full` ships
// ~9MB of TypeScript output and is firmly server-only. The
// `liteAdaptor` (the only adaptor we use) does not touch `document` /
// `window`, so the renderer would technically run in the browser too
// — but we deliberately keep that path closed to spare the editor
// bundle the cost. The editor reaches the renderer through an admin-
// gated API endpoint instead; see the `admin.renderMath` resource
// route.

export interface MathjaxRenderer {
  render: (tex: string, display: boolean) => string
}

const RENDERER_KEY = Symbol.for('yufan.me/markdown/mathjax-renderer')
type RendererGlobal = {
  [RENDERER_KEY]?: Promise<MathjaxRenderer>
}

export function getMathjaxRenderer(): Promise<MathjaxRenderer> {
  const slot = globalThis as unknown as RendererGlobal
  if (slot[RENDERER_KEY] === undefined) {
    slot[RENDERER_KEY] = createMathjaxRenderer()
  }
  return slot[RENDERER_KEY]
}

async function createMathjaxRenderer(): Promise<MathjaxRenderer> {
  const [{ liteAdaptor }, { RegisterHTMLHandler }, { TeX }, { AllPackages }, { mathjax }, { SVG }] = await Promise.all([
    import('mathjax-full/js/adaptors/liteAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/output/svg.js'),
  ])

  const adaptor = liteAdaptor()
  // The handler registration is intentionally retained for the lifetime
  // of the process — see the module comment above.
  RegisterHTMLHandler(adaptor)

  const document = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'none' }),
  })

  return {
    render(tex: string, display: boolean): string {
      const node = document.convert(tex, { display })
      return adaptor.outerHTML(node)
    },
  }
}
