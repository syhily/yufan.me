// Single canonical KaTeX to MathML renderer for the entire blog. Page
// save / publish prerendering and the admin editor preview both flow
// through this module so draft previews and published pages cannot drift.

export interface KatexRenderer {
  render: (tex: string, display: boolean) => Promise<string>
}

import { getOrCreateGlobalSingleton } from '@/server/infra/global-singleton'

const RENDERER_KEY = Symbol.for('yufan.me/markdown/katex-renderer')

export function getKatexRenderer(): Promise<KatexRenderer> {
  return getOrCreateGlobalSingleton(RENDERER_KEY, () => createKatexRenderer())
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
