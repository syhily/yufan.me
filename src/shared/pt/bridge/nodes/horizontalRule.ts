import type { PmBlockNode } from '@/shared/pt/bridge/types'
import type { HorizontalRuleBlock } from '@/shared/pt/schema'

export function horizontalRuleBlockToPmNode(_block: HorizontalRuleBlock): PmBlockNode {
  return { type: 'horizontalRule', attrs: { _key: _block._key } }
}
