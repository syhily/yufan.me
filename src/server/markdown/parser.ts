import type { Highlighter } from 'shiki'

import { LRUCache } from 'lru-cache'
import { Marked } from 'marked'
import markedShiki from 'marked-shiki'
import { bundledLanguages, createHighlighter } from 'shiki'
import { COMMENT_NODE, ELEMENT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'

import { SHIKI_THEME, shikiTransformers } from '@/server/markdown/shiki'

const globalForMarkdown = globalThis as unknown as {
  yufanCommentHighlighterPromise: Promise<Highlighter> | null | undefined
  yufanCommentMarkedPromise: Promise<Marked> | null | undefined
  yufanCommentMarkdownCache: LRUCache<string, Promise<string>> | undefined
}

// Lazily create the shiki highlighter the first time we parse a snippet.
// Loading every bundled language eagerly costs ~80ms even for routes that
// never render markdown (e.g. JSON action endpoints), so we defer.
function getHighlighter(): Promise<Highlighter> {
  if (globalForMarkdown.yufanCommentHighlighterPromise == null) {
    globalForMarkdown.yufanCommentHighlighterPromise = createHighlighter({
      langs: Object.keys(bundledLanguages),
      themes: [SHIKI_THEME],
    })
  }
  return globalForMarkdown.yufanCommentHighlighterPromise
}

// Reuse a single Marked instance across calls. `new Marked()` per call
// re-creates the lexer/parser pipeline and re-registers the shiki extension,
// which is expensive when rendering a comment thread (parseContent runs once
// per comment, often dozens of times in a single request).
function getMarked(): Promise<Marked> {
  if (globalForMarkdown.yufanCommentMarkedPromise == null) {
    globalForMarkdown.yufanCommentMarkedPromise = (async () => {
      const highlighter = await getHighlighter()
      return new Marked().use(
        markedShiki({
          highlight(code, lang, props) {
            return highlighter.codeToHtml(code, {
              lang,
              theme: SHIKI_THEME,
              meta: { __raw: props.join(' ') },
              transformers: shikiTransformers(),
            })
          },
        }),
      )
    })()
  }
  return globalForMarkdown.yufanCommentMarkedPromise
}

// Bounded LRU keyed by raw content. parseContent is called from
// `loader.server.ts` for every comment render and from category descriptions
// on cold start; both have a small working set that benefits from a tiny cache
// without growing unbounded under traffic.
const CACHE_LIMIT = 256
const cache = (globalForMarkdown.yufanCommentMarkdownCache ??= new LRUCache<string, Promise<string>>({
  max: CACHE_LIMIT,
}))

// Server-rendered placeholder for empty/missing comment bodies. Rendering
// "该留言内容为空" through marked + shiki + sanitize is wasteful (the result
// is always the same `<p>...</p>`), and it also pollutes the LRU cache with a
// hot key that pushes useful entries out. Returning a constant short-circuits
// the entire pipeline.
export const EMPTY_COMMENT_RAW = '该留言内容为空'
export const EMPTY_COMMENT_HTML = '<p>该留言内容为空</p>\n'

export async function parseContent(content: string | null | undefined): Promise<string> {
  if (content === null || content === undefined) {
    return EMPTY_COMMENT_HTML
  }
  // Normalize newlines
  const normalized = content.replace(/\r\n/g, '\n')
  if (normalized === '' || normalized === EMPTY_COMMENT_RAW) {
    return EMPTY_COMMENT_HTML
  }
  const cached = cache.get(normalized)
  if (cached) return cached

  const promise = renderContent(normalized)
  cache.set(normalized, promise)
  // Evict on failure so a transient parse error isn't pinned in the cache.
  promise.catch(() => cache.delete(normalized))
  return promise
}

// `ultrahtml/transformers/sanitize` only strips attributes that are in
// `dropAttributes`; whitelisted attributes via `allowAttributes` are NOT
// implicitly dropped from elements not listed there. To get a true allowlist
// we run a strict prune step after sanitize that drops any attribute whose
// (name, element) pair isn't in the whitelist below — and also strips raw
// HTML comments (which sanitize() leaves untouched despite `allowComments`
// being a documented option).
const ATTR_ALLOWLIST: Record<string, string[]> = {
  href: ['a'],
  src: ['img'],
  width: ['img'],
  height: ['img'],
  rel: ['a'],
  target: ['a'],
  class: ['pre', 'code', 'span'],
  style: ['pre', 'code', 'span'],
  // shiki's transformers add `tabindex="0"` on the wrapping <pre> for
  // accessibility (so keyboard users can scroll long code blocks). It's an
  // inert attribute, but we list it explicitly so the strict prune below
  // doesn't strip it and break our shiki fixtures / snapshots.
  tabindex: ['pre'],
  // GFM task lists render as `<input type="checkbox" disabled>` inside
  // `<li>`. Without these on the allowlist the strict prune below strips
  // every attribute, leaving an unstyled empty `<input>` that the browser
  // renders as a text box.
  type: ['input'],
  disabled: ['input'],
  checked: ['input'],
}

const ALLOWED_ELEMENTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'a',
  'img',
  'span',
  'strong',
  'code',
  'pre',
  'blockquote',
  'del',
  'i',
  'u',
  'sup',
  'sub',
  'em',
  'b',
  'font',
  'hr',
  'br',
  'ul',
  'ol',
  'li',
  'input',
]

async function renderContent(normalized: string): Promise<string> {
  const marked = await getMarked()
  // Let marked convert single line breaks into <br /> without breaking Markdown
  const parsed = await marked.parse(normalized, { breaks: true, gfm: true })
  // Avoid the XSS attack.
  return transform(parsed, [
    async (node) => {
      await walk(node, (node) => {
        if (node.type === ELEMENT_NODE) {
          if (node.name === 'a' && !node.attributes.href?.startsWith('https://yufan.me')) {
            node.attributes.target = '_blank'
            node.attributes.rel = 'nofollow'
          }
        }
      })
      return node
    },
    sanitize({ allowElements: ALLOWED_ELEMENTS, allowComments: false }),
    async (node) => {
      // Strict allowlist prune + comment stripper. Runs after sanitize so it
      // can rely on disallowed elements already being gone.
      await walk(node, (current) => {
        if (current.type === ELEMENT_NODE) {
          const attrs = current.attributes ?? {}
          for (const key of Object.keys(attrs)) {
            const allowedFor = ATTR_ALLOWLIST[key]
            if (!allowedFor || !allowedFor.includes(current.name)) {
              delete attrs[key]
            }
          }
        } else if (current.type === COMMENT_NODE) {
          ;(current as { value: string }).value = ''
        }
      })
      return node
    },
  ])
}
