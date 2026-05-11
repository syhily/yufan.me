import type { SolutionBlock } from '@/shared/pt/schema'

import type { PmBlockNode, PmNode } from '../types'

import { pushBlocks } from '../pt-to-pm'

export function solutionBlockToPmNode(block: SolutionBlock): PmBlockNode {
  const inner: PmNode[] = []
  pushBlocks(inner, block.children)
  if (inner.length === 0) {
    inner.push({ type: 'paragraph' })
  }
  return {
    type: 'solution',
    attrs: { _key: block._key },
    content: inner,
  }
}
