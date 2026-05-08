import type { RenderOptions as BeautifulMermaidRenderOptions, ThemeName } from 'beautiful-mermaid'
import type { Element, ElementContent } from 'hast'
import type { VFile } from 'vfile'

export interface CodeInstance {
  /** The mermaid diagram source. */
  diagram: string
  /** The inclusive ancestors of the element to process. */
  ancestors: Element[]
}

export interface RenderResult {
  svg: string
}

export interface RehypeMermaidOptions {
  /**
   * Theme name for diagrams. Available themes include: 'light', 'dark',
   * 'github-light', 'github-dark', 'tokyo-night'. See beautiful-mermaid
   * `THEMES` for the full list.
   */
  theme?: ThemeName

  /**
   * Create a fallback node if processing of a mermaid diagram fails. If
   * nothing is returned, the code block is removed.
   */
  errorFallback?: (
    element: Element,
    diagram: string,
    error: unknown,
    file: VFile,
  ) => ElementContent | null | undefined | void

  /** Render options forwarded to beautiful-mermaid. */
  renderOptions?: BeautifulMermaidRenderOptions
}
