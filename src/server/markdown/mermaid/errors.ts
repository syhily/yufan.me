import type { Element, ElementContent } from 'hast'
import type { VFile } from 'vfile'

import type { CodeInstance, RehypeMermaidOptions } from './types.ts'

// Centralised error path for the rehype-mermaid pipeline. If the consumer
// supplied an `errorFallback`, we delegate to it so the document still
// renders something visible; otherwise we attach a fatal vfile message so
// the build/test surfaces the broken diagram instead of silently dropping
// it. Keeping this in its own file lets the parse and render stages stay
// linear and side-effect-free.
export function handleError(
  reason: string | Error,
  instance: CodeInstance,
  file: VFile,
  options: RehypeMermaidOptions | undefined,
): ElementContent | null | undefined | void {
  const { ancestors, diagram } = instance
  const errorMessage = reason instanceof Error ? reason.message : reason

  if (options?.errorFallback) {
    return options.errorFallback(ancestors.at(-1) as Element, diagram, reason, file)
  }

  const message = file.message(errorMessage, {
    ruleId: 'rehype-mermaid',
    source: 'rehype-mermaid',
    ancestors,
  })
  message.fatal = true
  throw message
}
