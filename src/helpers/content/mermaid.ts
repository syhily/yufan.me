import type {
  RenderOptions as BeautifulMermaidRenderOptions,
  DiagramColors,
  ThemeName,
} from 'beautiful-mermaid'
import type { Element, ElementContent, Root } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'

import { Buffer } from 'node:buffer'
import { renderMermaid, THEMES } from 'beautiful-mermaid'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { toText } from 'hast-util-to-text'
import svgToDataURI from 'mini-svg-data-uri'
import sharp from 'sharp'
import { parse } from 'space-separated-tokens'
import { visitParents } from 'unist-util-visit-parents'

interface CodeInstance {
  /**
   * The mermaid diagram.
   */
  diagram: string

  /**
   * The inclusive ancestors of the element to process.
   */
  ancestors: Element[]
}

/**
 * A regular expression to test for non-whitespace characters.
 */
const nonWhitespacePattern = /\w/

/**
 * Allowed output strategies.
 */
type Strategy = 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid'

const strategies: Strategy[] = ['img-png', 'img-svg', 'inline-svg', 'pre-mermaid']

/**
 * Validate the strategy option is valid.
 *
 * @param strategy
 *   The user provided strategy.
 * @returns
 *   The strategy if valid.
 */
function validateStrategy(strategy: Strategy | undefined = 'inline-svg'): Strategy {
  if (strategies.includes(strategy)) {
    return strategy
  }
  throw new Error(`Expected strategy to be one of ${strategies.join(', ')}, got: ${strategy}`)
}

/**
 * Check if a hast element has the `language-mermaid` class name.
 *
 * @param element
 *   The hast element to check.
 * @param strategy
 *   The mermaid strategy to use.
 * @returns
 *   Whether or not the element has the `language-mermaid` class name.
 */
function isMermaidElement(element: Element, strategy: Strategy): boolean {
  let mermaidClassName: string

  if (element.tagName === 'pre') {
    if (strategy === 'pre-mermaid') {
      return false
    }
    mermaidClassName = 'mermaid'
  }
  else if (element.tagName === 'code') {
    mermaidClassName = 'language-mermaid'
  }
  else {
    return false
  }

  let className = element.properties?.className
  if (typeof className === 'string') {
    className = parse(className)
  }

  if (!Array.isArray(className)) {
    return false
  }

  return className.includes(mermaidClassName)
}

/**
 * Extract width and height from SVG string.
 *
 * @param svg
 *   The SVG string.
 * @returns
 *   An object with width and height, or undefined if not found.
 */
function extractSvgDimensions(svg: string): { width: number, height: number } | undefined {
  const widthMatch = svg.match(/width="(\d+)"/)
  const heightMatch = svg.match(/height="(\d+)"/)
  if (widthMatch && heightMatch) {
    return {
      width: Number.parseInt(widthMatch[1], 10),
      height: Number.parseInt(heightMatch[1], 10),
    }
  }
  // Try viewBox as fallback
  const viewBoxMatch = svg.match(/viewBox="[^"]*\s(\d+)\s(\d+)"/)
  if (viewBoxMatch) {
    return {
      width: Number.parseInt(viewBoxMatch[1], 10),
      height: Number.parseInt(viewBoxMatch[2], 10),
    }
  }
}

/**
 * Convert SVG to PNG data URI.
 *
 * @param svg
 *   The SVG string.
 * @returns
 *   A base64 PNG data URI.
 */
async function svgToPngDataURI(svg: string): Promise<string> {
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer()
  return `data:image/png;base64,${pngBuffer.toString('base64')}`
}

/**
 * Convert SVG to data URI.
 *
 * @param svg
 *   The SVG string.
 * @param isSrcset
 *   Whether the result is for a `srcset` or a `src` attribute.
 * @returns
 *   The data URI.
 */
function svgToDataURIString(svg: string, isSrcset?: boolean): string {
  return isSrcset ? svgToDataURI.toSrcset(svg) : svgToDataURI(svg)
}

/**
 * Render result interface.
 */
interface RenderResult {
  svg: string
  png?: string
  width?: number
  height?: number
}

/**
 * Convert a Mermaid render result to a hast element.
 *
 * @param result
 *   The Mermaid render result.
 * @param strategy
 *   The rendering strategy.
 * @returns
 *   An `<img>` element containing the diagram.
 */
async function toImageElement(
  result: RenderResult,
  strategy: Strategy,
): Promise<Element> {
  const isPng = strategy === 'img-png'
  const src = isPng
    ? (result.png || await svgToPngDataURI(result.svg))
    : svgToDataURIString(result.svg)

  return {
    type: 'element',
    tagName: 'img',
    properties: {
      alt: 'Mermaid Diagram',
      ...(result.width && { width: result.width }),
      ...(result.height && { height: result.height }),
      src,
    },
    children: [],
  }
}

/**
 * Handle an error.
 *
 * If the error fallback is defined, use its result. Otherwise an error is thrown.
 *
 * @param reason
 *   The reason the error occurred.
 * @param instance
 *   The diagram code instance.
 * @param file
 *   The file on which the error should be reported.
 * @param options
 *   The render options.
 * @returns
 *   The error fallback renderer.
 */
function handleError(
  reason: string | Error,
  instance: CodeInstance,
  file: VFile,
  options: RehypeMermaidOptions | undefined,
): ElementContent | null | undefined | void {
  const { ancestors, diagram } = instance
  const errorMessage = reason instanceof Error ? reason.message : reason
  if (options?.errorFallback) {
    return options.errorFallback(ancestors.at(-1)!, diagram, reason, file)
  }

  const message = file.message(errorMessage, {
    ruleId: 'rehype-mermaid',
    source: 'rehype-mermaid',
    ancestors,
  })
  message.fatal = true
  throw message
}

/**
 * Get render options for beautiful-mermaid.
 *
 * @param options
 *   The user-provided options.
 * @returns
 *   Render options for beautiful-mermaid.
 */
function getRenderOptions(
  options: RehypeMermaidOptions | undefined,
): BeautifulMermaidRenderOptions {
  const baseOptions: BeautifulMermaidRenderOptions = {
    ...options?.renderOptions,
  }

  // If custom colors are already provided, use them
  if (baseOptions.bg && baseOptions.fg) {
    return baseOptions
  }

  // Get theme colors if theme name is provided
  let theme: DiagramColors | undefined
  if (options?.theme && THEMES[options.theme]) {
    theme = THEMES[options.theme]
  }
  else {
    // Fallback to default light themes
    theme = THEMES.light || THEMES['github-light'] || THEMES.default
  }

  if (theme) {
    return {
      ...baseOptions,
      bg: baseOptions.bg || theme.bg,
      fg: baseOptions.fg || theme.fg,
      line: baseOptions.line || theme.line,
      accent: baseOptions.accent || theme.accent,
      muted: baseOptions.muted || theme.muted,
      surface: baseOptions.surface || theme.surface,
      border: baseOptions.border || theme.border,
    }
  }

  return baseOptions
}

export interface RehypeMermaidOptions {
  /**
   * Theme name for diagrams.
   *
   * Available themes include: 'light', 'dark', 'github-light', 'github-dark', 'tokyo-night', etc.
   * See beautiful-mermaid's THEMES for all available options.
   */
  theme?: ThemeName

  /**
   * Create a fallback node if processing of a mermaid diagram fails.
   *
   * @param element
   *   The hast element that could not be rendered.
   * @param diagram
   *   The Mermaid diagram that could not be rendered.
   * @param error
   *   The error that was thrown.
   * @param file
   *   The file on which the error occurred.
   * @returns
   *   A fallback node to render instead of the invalid diagram. If nothing is returned, the code
   *   block is removed
   */
  errorFallback?: (
    element: Element,
    diagram: string,
    error: unknown,
    file: VFile,
  ) => ElementContent | null | undefined | void

  /**
   * How to insert the rendered diagram into the document.
   *
   * - `'img-png'`: An `<img>` tag with the diagram as a base64 PNG data URL.
   * - `'img-svg'`: An `<img>` tag with the diagram as an SVG data URL.
   * - `'inline-svg'`: The SVG image as an inline `<svg>` element.
   * - `'pre-mermaid'`: The raw mermaid diagram as a child of a `<pre class="mermaid">` element.
   *
   * @default 'inline-svg'
   */
  strategy?: Strategy

  /**
   * Render options for beautiful-mermaid.
   */
  renderOptions?: BeautifulMermaidRenderOptions
}

/**
 * A [rehype](https://rehype.js.org) plugin to render [mermaid](https://mermaid-js.github.io)
 * diagrams using beautiful-mermaid for SSR rendering.
 *
 * @param options
 *   Options that may be used to tweak the output.
 */
const rehypeMermaid: Plugin<[RehypeMermaidOptions?], Root> = (options) => {
  const strategy = validateStrategy(options?.strategy)

  return async (ast, file) => {
    const instances: CodeInstance[] = []

    visitParents(ast, 'element', (node, ancestors) => {
      if (!isMermaidElement(node, strategy)) {
        return
      }

      const parent = ancestors.at(-1)!
      let inclusiveAncestors = ancestors as Element[]

      // This is <code> wrapped in a <pre> element.
      if (parent.type === 'element' && parent.tagName === 'pre') {
        for (const child of parent.children) {
          // We allow whitespace text siblings, but any other siblings mean we don't process the
          // diagram.
          if (child.type === 'text') {
            if (nonWhitespacePattern.test(child.value)) {
              return
            }
          }
          else if (child !== node) {
            return
          }
        }
      }
      else {
        inclusiveAncestors = [...inclusiveAncestors, node]
      }

      instances.push({
        diagram: toText(node, { whitespace: 'pre' }),
        ancestors: inclusiveAncestors,
      })
    })

    // Nothing to do. No need to render in this case.
    if (!instances.length) {
      return
    }

    if (strategy === 'pre-mermaid') {
      for (const { ancestors, diagram } of instances) {
        const parent = ancestors.at(-2)!
        const node = ancestors.at(-1)!

        parent.children[parent.children.indexOf(node)] = {
          type: 'element',
          tagName: 'pre',
          properties: {
            className: ['mermaid'],
          },
          children: [{ type: 'text', value: diagram }],
        }
      }
      return
    }

    // Render all diagrams
    const renderOptions = getRenderOptions(options)

    const renderPromises = instances.map(async (instance) => {
      try {
        const svg = await renderMermaid(instance.diagram, renderOptions)
        const dimensions = extractSvgDimensions(svg)
        const result: RenderResult = {
          svg,
          ...dimensions,
        }

        // Convert to PNG if needed
        if (strategy === 'img-png') {
          result.png = await svgToPngDataURI(svg)
        }

        return { status: 'fulfilled' as const, value: result }
      }
      catch (error) {
        return {
          status: 'rejected' as const,
          reason: error instanceof Error ? error : new Error(String(error)),
        }
      }
    })

    const results = await Promise.all(renderPromises)

    for (const [index, result] of results.entries()) {
      const instance = instances[index]
      let replacement: ElementContent | null | undefined | void

      if (result.status === 'rejected') {
        replacement = handleError(result.reason, instance, file, options)
      }
      else if (strategy === 'inline-svg') {
        replacement = fromHtmlIsomorphic(result.value.svg, { fragment: true })
          .children[0] as Element
      }
      else {
        replacement = await toImageElement(result.value, strategy)
      }

      const { ancestors } = instance
      const node = ancestors.at(-1)!
      const parent = ancestors.at(-2)!
      const nodeIndex = parent.children.indexOf(node)
      if (replacement) {
        parent.children[nodeIndex] = replacement
      }
      else {
        parent.children.splice(nodeIndex, 1)
      }
    }
  }
}

export default rehypeMermaid
