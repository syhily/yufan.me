import type { Root } from 'hast'
import type { Plugin } from 'unified'

import type { RehypeMermaidOptions } from './types.ts'

import { handleError } from './errors.ts'
import { collectDiagrams } from './parse.ts'
import { renderInstances, toReplacement } from './render.ts'

export type { RehypeMermaidOptions } from './types.ts'

/**
 * A [rehype](https://rehype.js.org) plugin to render
 * [mermaid](https://mermaid-js.github.io) diagrams using beautiful-mermaid
 * for SSR rendering.
 *
 * Internally split into:
 *  - `parse.ts` — finds candidate `<code class="language-mermaid">` blocks.
 *  - `render.ts` — runs beautiful-mermaid + builds replacement nodes.
 *  - `errors.ts` — single error path with vfile message escalation.
 *
 * @param options Options that may be used to tweak the output.
 */
const rehypeMermaid: Plugin<[RehypeMermaidOptions?], Root> = (options) => {
  return async (ast, file) => {
    const instances = collectDiagrams(ast)
    if (!instances.length) {
      return
    }

    const results = await renderInstances(instances, options)

    for (const [index, result] of results.entries()) {
      const instance = instances[index]
      let replacement
      if (result.status === 'rejected') {
        replacement = handleError(result.reason, instance, file, options)
      } else {
        try {
          replacement = await toReplacement(result.value)
        } catch (error) {
          replacement = handleError(error instanceof Error ? error : new Error(String(error)), instance, file, options)
        }
      }

      const { ancestors } = instance
      const node = ancestors.at(-1)
      const parent = ancestors.at(-2)
      if (!parent || !node) {
        continue
      }
      const nodeIndex = parent.children.indexOf(node)
      if (nodeIndex < 0) {
        continue
      }
      if (replacement) {
        parent.children[nodeIndex] = replacement
      } else {
        parent.children.splice(nodeIndex, 1)
      }
    }
  }
}

export default rehypeMermaid
