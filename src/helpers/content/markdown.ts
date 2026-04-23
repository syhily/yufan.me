import type { Highlighter } from 'shiki'

import { Marked } from 'marked'
import markedShiki from 'marked-shiki'
import { bundledLanguages, createHighlighter } from 'shiki'
import { ELEMENT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'

import { SHIKI_THEME, shikiTransformers } from '@/helpers/content/shiki'

// Lazily create the shiki highlighter the first time we parse a snippet.
// Loading every bundled language eagerly costs ~80ms even for routes that
// never render markdown (e.g. JSON action endpoints), so we defer.
let highlighterPromise: Promise<Highlighter> | null = null
function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighter({
      langs: Object.keys(bundledLanguages),
      themes: [SHIKI_THEME],
    })
  }
  return highlighterPromise
}

export async function parseContent(content: string): Promise<string> {
  // Normalize newlines
  const normalized = content.replace(/\r\n/g, '\n')
  const highlighter = await getHighlighter()
  // Let marked convert single line breaks into <br /> without breaking Markdown
  const parsed = await new Marked()
    .use(
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
    .parse(normalized, { breaks: true, gfm: true })
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
    sanitize({
      allowElements: [
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
      ],
      allowAttributes: {
        src: ['img'],
        width: ['img'],
        height: ['img'],
        rel: ['a'],
        target: ['a'],
        class: ['pre', 'code', 'span'],
        style: ['pre', 'code', 'span'],
      },
      allowComments: false,
    }),
  ])
}
