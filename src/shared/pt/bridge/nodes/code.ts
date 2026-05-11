import type { CodeBlock } from '@/shared/pt/schema'

import type { PmBlockNode } from '../types'

export function codeBlockToPmNode(block: CodeBlock): PmBlockNode {
  return {
    type: 'codeBlock',
    attrs: { _key: block._key, language: block.language, highlightedHtml: block.highlightedHtml },
    content: block.code === '' ? undefined : [{ type: 'text', text: block.code }],
  }
}
