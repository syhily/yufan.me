import type { Image, Root } from 'mdast'
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Plugin } from 'unified'

import { visit } from 'unist-util-visit'

/**
 * Remark plugin that collects all image URLs from MDX content.
 * Covers both Markdown `![alt](url)` syntax and JSX `<img src="url" />`.
 * Results are stored on `file.data.imageSources` as `string[]`.
 */
export const remarkCollectImages: Plugin<[], Root> = () => (tree, file) => {
  const sources = new Set<string>()

  visit(tree, (node) => {
    if (node.type === 'image') {
      const imageNode = node as Image
      if (imageNode.url) {
        sources.add(imageNode.url)
      }
      return
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const jsxNode = node as MdxJsxFlowElement | MdxJsxTextElement
      if (jsxNode.name === 'img') {
        const srcAttr = jsxNode.attributes.find(
          (attr): attr is MdxJsxAttribute => attr.type === 'mdxJsxAttribute' && attr.name === 'src',
        )
        if (typeof srcAttr?.value === 'string') {
          sources.add(srcAttr.value)
        }
      }
      return
    }
  })

  if (sources.size > 0) {
    file.data.imageSources = [...sources]
  }
}

export default remarkCollectImages
