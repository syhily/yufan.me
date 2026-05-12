import type { TwoColumnBlock } from '@/shared/pt/schema'

import type { PmBlockNode, PmNode } from '../types'

import { pushBlocks } from '../pt-to-pm'

export function twoColumnBlockToPmNode(block: TwoColumnBlock): PmBlockNode {
  const leftInner: PmNode[] = []
  const rightInner: PmNode[] = []
  pushBlocks(leftInner, block.left)
  pushBlocks(rightInner, block.right)
  if (leftInner.length === 0) {
    leftInner.push({ type: 'paragraph' })
  }
  if (rightInner.length === 0) {
    rightInner.push({ type: 'paragraph' })
  }
  const baseKey = block._key
  return {
    type: 'twoColumn',
    attrs: { _key: baseKey },
    content: [
      {
        type: 'twoColumnPane',
        attrs: { _key: `${baseKey}-pane-L`, side: 'left' },
        content: leftInner,
      },
      {
        type: 'twoColumnPane',
        attrs: { _key: `${baseKey}-pane-R`, side: 'right' },
        content: rightInner,
      },
    ],
  }
}
