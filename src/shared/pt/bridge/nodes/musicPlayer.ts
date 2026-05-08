import type { Block } from '@/shared/pt/schema'

import type { PmBlockNode } from '../types'

export function musicPlayerBlockToPmNode(block: Extract<Block, { _type: 'musicPlayer' }>): PmBlockNode {
  return {
    type: 'blockCard',
    attrs: { _key: block._key, _ptType: 'musicPlayer', payload: block },
  }
}
