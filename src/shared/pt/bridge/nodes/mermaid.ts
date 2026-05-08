import type { Block } from '@/shared/pt/schema'

import type { PmBlockNode } from '../types'

export function mermaidBlockToPmNode(block: Extract<Block, { _type: 'mermaid' }>): PmBlockNode {
  return {
    type: 'blockCard',
    attrs: { _key: block._key, _ptType: 'mermaid', payload: block },
  }
}
