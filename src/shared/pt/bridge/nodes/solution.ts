import type { SolutionBlock } from '@/shared/pt/schema'

import type { PmBlockNode, PmNode } from '../types'

export function solutionBlockToPmNode(
  block: SolutionBlock,
  pushBlocks: (out: PmNode[], blocks: readonly import('@/shared/pt/schema').Block[]) => void,
): PmBlockNode {
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
