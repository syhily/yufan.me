import {
  generateBlockKey,
  type FootnoteDefinitionBlock,
  type NonRecursiveBlock,
  type PortableTextBody,
  type TextBlock,
} from '@/shared/portable-text'
import { synchronizeFootnoteIndices } from '@/shared/pt-bridge'

export function extractFootnoteDefinitionBlocks(body: PortableTextBody): FootnoteDefinitionBlock[] {
  return body.filter((b): b is FootnoteDefinitionBlock => b._type === 'footnoteDefinition')
}

/** Body passed into `bodyToPmDoc` for the page editor — prose only; footnotes live in parallel state. */
export function stripFootnoteDefinitionsForEditor(body: PortableTextBody): PortableTextBody {
  return body.filter((b) => b._type !== 'footnoteDefinition')
}

export function mergeProseBodyWithFootnoteDefinitions(
  prose: PortableTextBody,
  defs: readonly FootnoteDefinitionBlock[],
): PortableTextBody {
  return synchronizeFootnoteIndices([...prose, ...defs])
}

export function plainTextToFootnoteChildren(text: string): NonRecursiveBlock[] {
  const trimmedEnd = text.replace(/\s+$/, '')
  const rawLines = trimmedEnd === '' ? [''] : trimmedEnd.split('\n')
  return rawLines.map((line) => ({
    _type: 'block' as const,
    _key: generateBlockKey(),
    style: 'normal' as const,
    children: [{ _type: 'span' as const, _key: generateBlockKey(), text: line }],
  }))
}

export function footnoteChildrenToPlainText(children: readonly NonRecursiveBlock[]): string {
  const lines: string[] = []
  for (const block of children) {
    if (block._type !== 'block') {
      continue
    }
    const tb = block as TextBlock
    lines.push(tb.children.map((s) => s.text).join(''))
  }
  return lines.join('\n')
}
