import { marked } from 'marked'
import { createHighlighter } from 'shiki'
import { ELEMENT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'

const highlighter = await createHighlighter({
  themes: ['solarized-light'],
  langs: ['javascript'],
})

export async function parseContent(content: string): Promise<string> {
  // Normalize newlines
  let normalized = content.replace(/\r\n/g, '\n')

  // Highlight fenced code blocks with Shiki first so the Markdown parser
  // won't interfere. We replace only fenced code blocks (```lang ... ```)
  const fenceRe = /```([\w+-]*)\n([\s\S]*?)\n```/g
  const matches = Array.from(normalized.matchAll(fenceRe))
  for (const m of matches) {
    const lang = (m[1] && m[1].length > 0) ? m[1] : 'text'
    const code = m[2]
    // Use shiki to produce highlighted HTML (includes <pre> and <code>)
    // cast to any because shiki typings differ between versions
    const highlighted = highlighter.codeToHtml(code, { theme: 'solarized-light', lang: lang ?? 'text' })
    // Replace the fenced block with highlighted HTML
    normalized = normalized.replace(m[0], highlighted)
  }

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
        // Allow class/style on pre/code/span so Shiki's output is preserved
        class: ['pre', 'code', 'span'],
        style: ['pre', 'code', 'span'],
      },
      allowComments: false,
    }),
  ])
}
