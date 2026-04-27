import type { MDXComponents } from 'mdx/types'
import type { ComponentProps } from 'react'

import { executeMdxSync } from '@fumadocs/mdx-remote/client'
import { LRUCache } from 'lru-cache'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { COMMENT_NODE, ELEMENT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'

import { compileMarkdown } from '@/server/markdown/runtime'

const globalForMarkdown = globalThis as unknown as {
  yufanCommentMarkdownCache: LRUCache<string, Promise<string>> | undefined
}

function mdxNoop(): null {
  return null
}

// Post-level MDX tags that may appear in user comments but must not pull
// `ui/` into the email HTML pipeline (server layering). They are no-ops here,
// matching the `comment` compile profile (no figure / widget passes).
const emailMdxComponents: MDXComponents = {
  MusicPlayer: mdxNoop,
  Solution: mdxNoop,
  Friends: mdxNoop,
  // Raw HTML can compile to a string `style` prop; React rejects that during
  // `renderToStaticMarkup`. Strip it here — `ultrahtml` already drops `style`
  // on anchors in the post-sanitize prune pass for security.
  a: (props: ComponentProps<'a'>) => {
    const { style: _style, ...rest } = props
    return createElement('a', rest)
  },
}

// Bounded LRU keyed by raw content. parseContent is called from
// `sender.ts` for every outbound email and from category descriptions
// on cold start; both have a small working set that benefits from a tiny cache
// without growing unbounded under traffic.
const CACHE_LIMIT = 256
const cache = (globalForMarkdown.yufanCommentMarkdownCache ??= new LRUCache<string, Promise<string>>({
  max: CACHE_LIMIT,
}))

// Server-rendered placeholder for empty/missing comment bodies. Returning a
// constant short-circuits the compile + render pipeline.
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
  // `compileMarkdown` trims; legacy email HTML still rendered whitespace-only
  // bodies (e.g. a lone `\n` with `breaks: true`) into non-empty HTML.
  if (normalized.trim() === '') {
    return '<p><br /></p>\n'
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
  width: ['img', 'rect', 'svg'],
  height: ['img', 'rect', 'svg'],
  rel: ['a'],
  target: ['a'],
  class: ['pre', 'code', 'span', 'svg', 'g', 'path', 'rect', 'line', 'polygon', 'circle', 'ellipse', 'use'],
  style: ['pre', 'code', 'span', 'svg', 'g', 'path', 'rect', 'line', 'polygon', 'circle', 'ellipse', 'use'],
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
  xmlns: ['svg'],
  viewBox: ['svg'],
  fill: ['path', 'g', 'svg', 'rect', 'circle', 'ellipse', 'polygon', 'line'],
  stroke: ['path', 'g', 'svg', 'rect', 'circle', 'ellipse', 'line', 'polygon'],
  d: ['path'],
  x: ['rect', 'use', 'text'],
  y: ['rect', 'use', 'text'],
  points: ['polygon', 'polyline'],
  cx: ['circle', 'ellipse'],
  cy: ['circle', 'ellipse'],
  r: ['circle'],
  rx: ['ellipse', 'rect'],
  ry: ['ellipse', 'rect'],
  'stroke-width': ['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'g'],
  'stroke-linecap': ['path', 'line'],
  'stroke-linejoin': ['path'],
  'fill-opacity': ['path', 'g'],
  'stroke-opacity': ['path'],
  'aria-hidden': ['svg'],
  focusable: ['svg'],
  role: ['svg'],
  transform: ['g', 'svg', 'use'],
  overflow: ['svg'],
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
  'svg',
  'g',
  'path',
  'defs',
  'clipPath',
  'use',
  'rect',
  'line',
  'polyline',
  'polygon',
  'circle',
  'ellipse',
  'foreignObject',
  'text',
  // MathJax 4 wraps formulas in custom elements; keep the subtree so email
  // notifications match the in-app comment renderer.
  'mjx-container',
  'mjx-math',
  'mjx-assistive-mml',
  'mjx-svg',
]

async function renderContent(normalized: string): Promise<string> {
  const compiled = await compileMarkdown(normalized, { profile: 'email' })
  if (compiled === null) {
    return EMPTY_COMMENT_HTML
  }
  const Body = executeMdxSync(compiled.compiled).default
  const parsed = renderToStaticMarkup(createElement(Body, { components: emailMdxComponents }))
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
