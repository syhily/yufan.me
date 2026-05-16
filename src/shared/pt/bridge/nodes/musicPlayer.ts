import type { PmBlockNode } from '@/shared/pt/bridge/types'
import type { Block } from '@/shared/pt/schema'

export function musicPlayerBlockToPmNode(block: Extract<Block, { _type: 'musicPlayer' }>): PmBlockNode {
  return {
    type: 'blockCard',
    attrs: { _key: block._key, _ptType: 'musicPlayer', payload: block },
  }
}
