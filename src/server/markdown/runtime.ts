import type { Element as HastElement } from 'hast'
import type { Options as RehypeExternalLinksOptions } from 'rehype-external-links'
import type { PluggableList } from 'unified'

import { createCompiler } from '@fumadocs/mdx-remote'
import { remarkGfm } from 'fumadocs-core/mdx-plugins'
import { LRUCache } from 'lru-cache'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'

import { rehypeCodeWithGlobalCache } from '@/server/markdown/rehype-code'
import rehypeMathjax from '@/server/markdown/rehype-mathjax'

// Runtime MDX compiler shared by the comments + category-description
// pipelines and the email HTML string path (`email` profile). `comment` /
// `category` use MDX; `email` uses CommonMark-only `format: 'md'` so raw
// `<style>` / `<!-- -->` fragments match the legacy HTML-in-markdown
// hardening tests without JSX parse failures. The `category` profile adds
// `rehype-title-figure` because admin-authored category descriptions
// occasionally lead with an image, while comments keep the pass off because
// untrusted user markdown should not auto-promote images to figures.
//
// Output is a JS function-body string produced by `@mdx-js/mdx` with
// `outputFormat: 'function-body'`. The same string is shipped from the
// loader to the client so SSR and hydration both render via
// `executeMdxSync(compiled)`. Server only — never import from `client/`,
// `ui/`, or `shared/`.
export type CompileProfile = 'comment' | 'category' | 'email'

export interface CompiledMarkdown {
  /** JS function-body string consumed by `executeMdxSync`. */
  compiled: string
  /** Trimmed raw markdown source. Used for SEO descriptions where the
   * downstream consumer wants a string. */
  plain: string
}

const RC_OPTIONS = {
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
  addLanguageClass: true,
  fallbackLanguage: 'plaintext',
  langAlias: {
    math: 'plaintext',
  },
} satisfies Partial<import('fumadocs-core/mdx-plugins/rehype-code').RehypeCodeOptions>

function isSameSiteYufanHref(href: unknown): boolean {
  return typeof href === 'string' && href.startsWith('https://yufan.me')
}

/** Same-tab for `https://yufan.me/*`; `target` + `rel` only off-site. */
const rehypeExternalLinkOptions = {
  rel: (element: HastElement) => (isSameSiteYufanHref(element.properties?.href) ? [] : ['nofollow']),
  target: (element: HastElement) => (isSameSiteYufanHref(element.properties?.href) ? undefined : '_blank'),
} satisfies RehypeExternalLinksOptions

const globalForRuntime = globalThis as unknown as {
  yufanRuntimeCompilers: Map<CompileProfile, ReturnType<typeof createCompiler>> | undefined
  yufanRuntimeCompileCache: LRUCache<string, Promise<CompiledMarkdown>> | undefined
}

function buildCompiler(profile: CompileProfile): ReturnType<typeof createCompiler> {
  return createCompiler({
    preset: 'minimal',
    format: profile === 'email' ? 'md' : 'mdx',
    outputFormat: 'function-body',
    development: false,
    remarkPlugins: [remarkGfm, remarkBreaks, remarkMath],
    rehypePlugins: [
      [rehypeMathjax, { svg: { fontCache: 'global' } }],
      [rehypeCodeWithGlobalCache, RC_OPTIONS],
      // `rehypeTitleFigure` is admin-authoring sugar — only enabled for the
      // category profile to keep untrusted comment markdown from spawning
      // `<figure>` wrappers around in-line images.
      ...(profile === 'category' ? [rehypeTitleFigure] : []),
      [rehypeExternalLinks, rehypeExternalLinkOptions],
      ...(profile === 'email'
        ? []
        : [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'append' as const, properties: {} }]]),
    ] as PluggableList,
  })
}

function getCompiler(profile: CompileProfile): ReturnType<typeof createCompiler> {
  const compilers = (globalForRuntime.yufanRuntimeCompilers ??= new Map())
  let compiler = compilers.get(profile)
  if (compiler === undefined) {
    compiler = buildCompiler(profile)
    compilers.set(profile, compiler)
  }
  return compiler
}

// Bounded LRU keyed by `(profile, normalized source)`. The working set is
// small in practice (hot comments and ~12 category descriptions) but the
// fan-out can be high when an admin loads a long detail page or the comment
// list thread, so this trims redundant `mathjax + shiki` round-trips.
const CACHE_LIMIT = 256
const cache = (globalForRuntime.yufanRuntimeCompileCache ??= new LRUCache<string, Promise<CompiledMarkdown>>({
  max: CACHE_LIMIT,
}))

function cacheKey(profile: CompileProfile, source: string): string {
  return `${profile}\x00${source}`
}

export async function compileMarkdown(
  source: string | null | undefined,
  options: { profile: CompileProfile },
): Promise<CompiledMarkdown | null> {
  if (source === null || source === undefined) {
    return null
  }
  const normalized = source.replace(/\r\n/g, '\n').trim()
  if (normalized === '') {
    return null
  }

  const key = cacheKey(options.profile, normalized)
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const promise = compileImpl(normalized, options.profile)
  cache.set(key, promise)
  // Evict on failure so a transient parse error isn't pinned in the cache.
  promise.catch(() => cache.delete(key))
  return promise
}

async function compileImpl(source: string, profile: CompileProfile): Promise<CompiledMarkdown> {
  const compiler = getCompiler(profile)
  const result = await compiler.compile({ source, skipRender: true })
  return {
    compiled: result.compiled,
    plain: source,
  }
}
