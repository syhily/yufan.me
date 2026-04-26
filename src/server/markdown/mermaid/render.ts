import type { RenderOptions as BeautifulMermaidRenderOptions, DiagramColors } from 'beautiful-mermaid'
import type { Element } from 'hast'

import type { CodeInstance, RehypeMermaidOptions, RenderResult } from './types.ts'

type BeautifulMermaidModule = typeof import('beautiful-mermaid')

let beautifulMermaidPromise: Promise<BeautifulMermaidModule> | undefined

function loadBeautifulMermaid(): Promise<BeautifulMermaidModule> {
  beautifulMermaidPromise ??= import('beautiful-mermaid')
  return beautifulMermaidPromise
}

// Resolve the colour palette for beautiful-mermaid: explicit user options
// always win; otherwise we apply the named theme, falling back to a
// reasonable light default so a missing theme name still produces a
// usable diagram instead of an unstyled one.
export async function getRenderOptions(
  options: RehypeMermaidOptions | undefined,
): Promise<BeautifulMermaidRenderOptions> {
  const baseOptions: BeautifulMermaidRenderOptions = {
    ...options?.renderOptions,
  }

  if (baseOptions.bg && baseOptions.fg) {
    return baseOptions
  }

  let theme: DiagramColors | undefined
  const { THEMES } = await loadBeautifulMermaid()
  if (options?.theme && THEMES[options.theme]) {
    theme = THEMES[options.theme]
  } else {
    theme = THEMES.light || THEMES['github-light'] || THEMES.default
  }

  if (theme) {
    return {
      ...baseOptions,
      bg: baseOptions.bg || theme.bg,
      fg: baseOptions.fg || theme.fg,
      line: baseOptions.line || theme.line,
      accent: baseOptions.accent || theme.accent,
      muted: baseOptions.muted || theme.muted,
      surface: baseOptions.surface || theme.surface,
      border: baseOptions.border || theme.border,
    }
  }

  return baseOptions
}

export type SettledRender = { status: 'fulfilled'; value: RenderResult } | { status: 'rejected'; reason: Error }

// Run renderMermaidSVGAsync for every collected instance in parallel,
// converting each promise into a `Promise.allSettled`-shaped value. We
// keep the per-instance shape explicit so failures can still be paired with
// their original source block by the plugin.
export async function renderInstances(
  instances: CodeInstance[],
  options: RehypeMermaidOptions | undefined,
): Promise<SettledRender[]> {
  const [{ renderMermaidSVGAsync }, renderOptions] = await Promise.all([
    loadBeautifulMermaid(),
    getRenderOptions(options),
  ])
  const cache = new Map<string, Promise<SettledRender>>()

  return Promise.all(
    instances.map((instance): Promise<SettledRender> => {
      // The cache key intentionally includes the fully-resolved
      // `renderOptions` (bg/fg/line/accent/muted/surface/border …) and
      // not just the diagram source. This ensures the same diagram
      // rendered against different themes (e.g. light vs dark) gets
      // distinct cached SVGs instead of one theme's render leaking into
      // the other. Diagrams with identical theme colours still dedupe.
      const cacheKey = JSON.stringify({ diagram: instance.diagram, renderOptions })
      let settled = cache.get(cacheKey)
      if (settled !== undefined) return settled

      settled = (async (): Promise<SettledRender> => {
        try {
          const svg = await renderMermaidSVGAsync(instance.diagram, renderOptions)
          return { status: 'fulfilled', value: { svg } }
        } catch (error) {
          return {
            status: 'rejected',
            reason: error instanceof Error ? error : new Error(String(error)),
          }
        }
      })()
      cache.set(cacheKey, settled)
      return settled
    }),
  )
}

// Coerce a successful render into the inline SVG hast replacement node. The
// renderer is expected to return a single SVG root; anything else is treated as
// a broken diagram so the plugin can surface it through the shared error path.
export async function toReplacement(result: RenderResult): Promise<Element> {
  const { fromHtmlIsomorphic } = await import('hast-util-from-html-isomorphic')
  const node = fromHtmlIsomorphic(result.svg, { fragment: true }).children[0]
  if (node?.type === 'element' && node.tagName === 'svg') {
    return node
  }
  throw new Error('Mermaid renderer returned a non-SVG result')
}
