// Single canonical KaTeX to MathML renderer for the entire blog. Page
// save / publish prerendering and the admin editor preview both flow
// through this module so draft previews and published pages cannot drift.

export interface KatexRenderer {
  render: (tex: string, display: boolean) => Promise<string>
}

const RENDERER_KEY = Symbol.for('yufan.me/markdown/katex-renderer')

type RendererGlobal = {
  [RENDERER_KEY]?: Promise<KatexRenderer>
}

export function getKatexRenderer(): Promise<KatexRenderer> {
  const slot = globalThis as unknown as RendererGlobal
  if (slot[RENDERER_KEY] === undefined) {
    slot[RENDERER_KEY] = createKatexRenderer()
  }
  return slot[RENDERER_KEY]
}

async function createKatexRenderer(): Promise<KatexRenderer> {
  const [{ default: katex }] = await Promise.all([import('katex'), import('katex/contrib/mhchem')])

  return {
    async render(tex: string, display: boolean): Promise<string> {
      return katex.renderToString(tex, {
        displayMode: display,
        output: 'mathml',
        throwOnError: true,
        trust: false,
      })
    },
  }
}
