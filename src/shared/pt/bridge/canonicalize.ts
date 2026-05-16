import type { PortableTextBody } from '@/shared/pt/schema'

import { pmDocToBody } from '@/shared/pt/bridge/pm-to-pt'
import { bodyToPmDoc } from '@/shared/pt/bridge/pt-to-pm'
import { portableTextBlockSemanticFingerprint } from '@/shared/pt/semantics'

/**
 * Canonicalise a PortableText body through the PT↔PM bridge.
 *
 * This collapses representational differences that are semantically
 * equivalent in the editor/runtime (for example list `level` omitted
 * vs. explicit `level: 1`, or mixed-list nesting expressed through
 * different intermediate PM trees).
 */
function canonicalizePortableTextBodyShape(body: PortableTextBody): PortableTextBody {
  return pmDocToBody(bodyToPmDoc(body))
}

/**
 * Semantic equality helper for conflict detection / "dirty" checks.
 *
 * Uses canonical PT forms so equivalent list shapes do not trigger
 * false-positive "content mismatch" prompts.
 *
 * Block-wise comparison matches the admin PortableText diff's anchor
 * construction (`portable-text-diff` ⇆ `@/shared/portable-text-semantics`):
 * `_key` regeneration, Postgres `jsonb` key reordering, omitted vs
 * present prerender artefacts (`highlightedHtml`, SVG), and markupDef
 * key reshuffles must not resurrect spurious mismatches versus what the
 * operator sees as UNCHANGED rows.
 */
export function arePortableTextBodiesEquivalent(left: PortableTextBody, right: PortableTextBody): boolean {
  const canonLeft = canonicalizePortableTextBodyShape(left)
  const canonRight = canonicalizePortableTextBodyShape(right)
  if (canonLeft.length !== canonRight.length) {
    return false
  }
  for (let i = 0; i < canonLeft.length; i++) {
    if (portableTextBlockSemanticFingerprint(canonLeft[i]) !== portableTextBlockSemanticFingerprint(canonRight[i])) {
      return false
    }
  }
  return true
}
