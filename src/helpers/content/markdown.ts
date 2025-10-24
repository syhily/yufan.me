import { marked } from 'marked'
import { ELEMENT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'

export async function parseContent(content: string): Promise<string> {
  // Normalize newlines
  const normalized = content.replace(/\r\n/g, '\n')
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
        class: ['pre', 'code', 'span'],
        style: ['pre', 'code', 'span'],
      },
      allowComments: false,
    }),
  ])
}
