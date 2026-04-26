import type { Element, Root } from 'hast'

import { toText } from 'hast-util-to-text'
import { parse as parseTokens } from 'space-separated-tokens'
import { SKIP, visitParents } from 'unist-util-visit-parents'

import type { CodeInstance } from './types.ts'

const NON_WHITESPACE = /\S/

function isMermaidElement(element: Element): boolean {
  let mermaidClassName: string
  if (element.tagName === 'pre') {
    mermaidClassName = 'mermaid'
  } else if (element.tagName === 'code') {
    mermaidClassName = 'language-mermaid'
  } else {
    return false
  }

  let className = element.properties?.className
  if (typeof className === 'string') {
    className = parseTokens(className)
  }
  if (!Array.isArray(className)) return false
  return className.includes(mermaidClassName)
}

// Walk the hast tree and collect every diagram instance (`{diagram, ancestors}`).
// We treat `<code class="language-mermaid">` wrapped in a single `<pre>`
// (the markdown-rendered shape) as the canonical case; the `<code>`'s
// inclusive ancestors give us a stable target for replacement later.
export function collectDiagrams(ast: Root): CodeInstance[] {
  const instances: CodeInstance[] = []

  visitParents(ast, 'element', (node, ancestors) => {
    if (!isMermaidElement(node)) return

    const parent = ancestors.at(-1)
    if (!parent) return
    let inclusiveAncestors = ancestors as Element[]

    // <code> wrapped in a <pre>: bail if the <pre> has any non-whitespace
    // siblings, because that means the markdown author put extra inline
    // content next to the diagram and we shouldn't rewrite it.
    if (parent.type === 'element' && parent.tagName === 'pre') {
      for (const child of parent.children) {
        if (child.type === 'text') {
          if (NON_WHITESPACE.test(child.value)) return
        } else if (child !== node) {
          return
        }
      }
    } else {
      inclusiveAncestors = [...inclusiveAncestors, node]
    }

    instances.push({
      diagram: toText(node, { whitespace: 'pre' }),
      ancestors: inclusiveAncestors,
    })

    return SKIP
  })

  return instances
}
