import type { HorizontalRuleBlock } from '@/shared/pt/schema'

import type { PmBlockNode } from '../types'

export function horizontalRuleBlockToPmNode(_block: HorizontalRuleBlock): PmBlockNode {
  return { type: 'horizontalRule', attrs: { _key: _block._key } }
}
