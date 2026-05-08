import type { ImageBlock } from '@/shared/pt/schema'

import type { PmBlockNode } from '../types'

export function imageBlockToPmNode(block: ImageBlock): PmBlockNode {
  const layout = block.layout === 'left' || block.layout === 'right' ? block.layout : undefined
  return {
    type: 'image',
    attrs: {
      _key: block._key,
      src: block.src,
      alt: block.alt,
      caption: block.caption,
      layout,
      width: block.width,
      height: block.height,
      thumbhash: block.thumbhash,
      storagePath: block.storagePath,
      imageId: block.imageId,
    },
  }
}
