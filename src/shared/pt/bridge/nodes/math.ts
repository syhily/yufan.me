import type { PmBlockNode } from '@/shared/pt/bridge/types'
import type { Block } from '@/shared/pt/schema'

export function mathBlockToPmNode(block: Extract<Block, { _type: 'mathBlock' }>): PmBlockNode {
  return {
    type: 'blockCard',
    attrs: { _key: block._key, _ptType: 'mathBlock', payload: block },
  }
}
