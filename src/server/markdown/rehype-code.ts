import type { RehypeCodeOptions } from 'fumadocs-core/mdx-plugins/rehype-code'

import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins/rehype-code'
import { createRehypeCode } from 'fumadocs-core/mdx-plugins/rehype-code.core'
import { createHighlighter, createJavaScriptRegexEngine, createOnigurumaEngine } from 'shiki'

type CachedHighlighter = Awaited<ReturnType<typeof createHighlighter>>

type CacheKeyOptions = Pick<RehypeCodeOptions, 'engine' | 'langAlias'>

const globalForShiki = globalThis as unknown as {
  yufanMdxShikiHighlighters: Map<string, Promise<CachedHighlighter>> | undefined
}

function cacheKey(options: CacheKeyOptions): string {
  return JSON.stringify({
    engine: options.engine ?? 'js',
    langAlias: stableRecord(options.langAlias),
  })
}

function stableRecord(record: Record<string, string> | undefined): Record<string, string> | undefined {
  if (record === undefined) return undefined
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}

async function createCachedHighlighter(options: CacheKeyOptions): Promise<CachedHighlighter> {
  const engine =
    options.engine === 'oniguruma' ? createOnigurumaEngine(import('shiki/wasm')) : createJavaScriptRegexEngine()

  return createHighlighter({
    langs: [],
    themes: [],
    langAlias: options.langAlias,
    engine,
  })
}

function getCachedHighlighter(options: CacheKeyOptions): Promise<CachedHighlighter> {
  const highlighters = (globalForShiki.yufanMdxShikiHighlighters ??= new Map())
  const key = cacheKey(options)
  let highlighter = highlighters.get(key)
  if (highlighter === undefined) {
    highlighter = createCachedHighlighter(options)
    highlighters.set(key, highlighter)
  }
  return highlighter
}

export const rehypeCodeWithGlobalCache = createRehypeCode<Partial<RehypeCodeOptions>>(async (_options) => {
  const options = {
    ...rehypeCodeDefaultOptions,
    ..._options,
  }

  return {
    highlighter: await getCachedHighlighter(options),
    options,
  }
})
