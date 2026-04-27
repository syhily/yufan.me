import type { Element, ElementContent, Root, RootContent, Text } from 'hast'
import type { LiteDocument } from 'mathjax-full/js/adaptors/lite/Document.js'
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js'
import type { LiteText } from 'mathjax-full/js/adaptors/lite/Text.js'
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js'
import type { OutputJax } from 'mathjax-full/js/core/OutputJax.js'
import type { HTMLHandler } from 'mathjax-full/js/handlers/html/HTMLHandler.js'
import type { OptionList } from 'mathjax-full/js/util/Options.js'
import type { VFile } from 'vfile'

import { toText } from 'hast-util-to-text'
import { h } from 'hastscript'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { SVG } from 'mathjax-full/js/output/svg.js'

interface MathjaxOptions {
  svg?: OptionList
  tex?: OptionList
}

interface RenderOptions {
  display: boolean
}

interface Renderer {
  register: () => void
  render: (value: string, options: RenderOptions) => ElementContent[]
  styleSheet: () => Element
  pageElements: () => Element | undefined
  unregister: () => void
}

type ParentNode = Root | Element
type ChildNode = RootContent | ElementContent
type NodeWithChildren = { children: unknown[]; type?: string }

const emptyOptions: MathjaxOptions = {}
const emptyClasses: unknown[] = []

export default function rehypeMathjax(options: MathjaxOptions = emptyOptions) {
  return function transform(tree: Root, file: VFile) {
    const renderer = createRenderer(options, new SVG(options.svg))
    let found = false
    let styleContext: ParentNode = tree
    let pageContext: ParentNode = tree

    renderer.register()

    try {
      visitElements(tree, (element, parent, replace) => {
        const classes = Array.isArray(element.properties.className) ? element.properties.className : emptyClasses
        const languageMath = classes.includes('language-math')
        const mathDisplay = classes.includes('math-display')
        const mathInline = classes.includes('math-inline')
        const fencedMath = isFencedMath(element)

        if (element.tagName === 'head') {
          styleContext = element
        } else if (element.tagName === 'body') {
          pageContext = element
        }

        if (!fencedMath && !languageMath && !mathDisplay && !mathInline) {
          return true
        }

        if (element.tagName === 'code' && languageMath && isElement(parent) && parent.tagName === 'pre') {
          return true
        }

        found = true
        const display = fencedMath || mathDisplay

        try {
          const rendered = renderer.render(toText(element, { whitespace: 'pre' }), { display })
          // Tag the produced `<mjx-container>` so the legacy
          // Bootstrap-era `.prose-host mjx-container[jax='SVG'][display='true']`
          // overflow rule can be expressed as Tailwind utilities directly
          // on the element. Display-mode formulas may overflow narrow
          // viewports; inline math should not be width-clipped.
          decorateMjxContainers(rendered, display)
          replace(rendered)
        } catch (error) {
          const cause = error instanceof Error ? error : new Error(String(error))
          file.message('Could not render math with mathjax', {
            ancestors: [element],
            cause,
            place: element.position,
            ruleId: 'mathjax-error',
            source: 'rehype-mathjax',
          })

          replace([
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['mathjax-error'],
                style: 'color:#cc0000',
                title: String(cause),
              },
              children: [{ type: 'text', value: toText(element, { whitespace: 'pre' }) }],
            },
          ])
        }

        return false
      })

      if (found) {
        styleContext.children.push(renderer.styleSheet())

        const pageElements = renderer.pageElements()
        if (pageElements) {
          pageContext.children.push(pageElements)
        }
      }
    } finally {
      renderer.unregister()
    }
  }
}

function createRenderer(options: MathjaxOptions, output: OutputJax<LiteElement, LiteText, LiteDocument>): Renderer {
  const input = new TeX<LiteElement, LiteText, LiteDocument>({
    packages: AllPackages,
    ...options.tex,
  })
  let document: MathDocument<LiteElement, LiteText, LiteDocument>
  let handler: HTMLHandler<LiteElement | LiteText, LiteText, LiteDocument>

  return {
    register() {
      const adaptor = liteAdaptor()
      handler = RegisterHTMLHandler(adaptor)
      document = mathjax.document('', { InputJax: input, OutputJax: output })
    },
    render(value, options) {
      const liteElement = document.convert(value, options) as LiteElement
      return [fromLiteElement(liteElement)]
    },
    styleSheet() {
      const node = fromLiteElement(output.styleSheet(document))
      node.properties.id = undefined
      return node
    },
    pageElements() {
      const node = output.pageElements(document)
      return node ? fromLiteElement(node) : undefined
    },
    unregister() {
      mathjax.handlers.unregister(handler)
    },
  }
}

function visitElements(
  parent: NodeWithChildren,
  visitor: (
    element: Element,
    parent: NodeWithChildren | undefined,
    replace: (children: ElementContent[]) => void,
  ) => boolean | undefined,
) {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index]

    if (!isElement(child)) {
      if (hasChildren(child)) {
        visitElements(child, visitor)
      }

      continue
    }

    const replace = (children: ElementContent[]) => {
      parent.children.splice(index, 1, ...(children as ChildNode[]))
      index += children.length - 1
    }

    const shouldContinue = visitor(child, parent, replace)
    if (shouldContinue === false) {
      continue
    }

    visitElements(child, visitor)
  }
}

function isElement(node: unknown): node is Element {
  return isRecord(node) && node.type === 'element'
}

function hasChildren(node: unknown): node is NodeWithChildren {
  return isRecord(node) && Array.isArray(node.children)
}

function isRecord(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null
}

function isFencedMath(element: Element): boolean {
  if (element.tagName !== 'pre') {
    return false
  }

  return element.children.some((child) => {
    if (!isElement(child) || child.tagName !== 'code') {
      return false
    }

    const classes = Array.isArray(child.properties.className) ? child.properties.className : emptyClasses
    return classes.includes('language-math')
  })
}

function fromLiteElement(liteElement: LiteElement): Element {
  const children: Array<Element | Text> = []

  for (const node of liteElement.children) {
    children.push('value' in node ? { type: 'text', value: node.value } : fromLiteElement(node))
  }

  return h(liteElement.kind, liteElement.attributes, children)
}

// Walk the rendered MathJax subtree and stamp `mjx-container` elements
// with className utilities. Display-mode formulas get a horizontal
// scroll surface (replaces the legacy Bootstrap-era
// `.prose-host mjx-container[jax='SVG'][display='true']` rule); the
// inner `<svg>` is allowed to exceed the container width
// (`max-w-none`) so long formulas do not get squashed before the
// overflow kicks in.
const DISPLAY_MJX_CLASSES = [
  'block',
  'max-w-full',
  'overflow-x-auto',
  'overflow-y-hidden',
  'pb-0.5',
  '[-webkit-overflow-scrolling:touch]',
  '[&>svg]:max-w-none',
]

function decorateMjxContainers(nodes: ElementContent[], display: boolean): void {
  for (const node of nodes) {
    if (!isElement(node)) continue
    if (node.tagName === 'mjx-container') {
      const properties = (node.properties ??= {})
      const existing = Array.isArray(properties.className) ? (properties.className as Array<string>) : []
      const additions = display ? DISPLAY_MJX_CLASSES : ['inline-block', '[&>svg]:max-w-none']
      properties.className = [...existing, ...additions]
    }
    if (Array.isArray(node.children)) {
      decorateMjxContainers(node.children as ElementContent[], display)
    }
  }
}
