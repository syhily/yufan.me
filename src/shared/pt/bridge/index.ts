// PortableText ↔ ProseMirror bridge.
//
// PortableText (PT) is the canonical on-the-wire representation: a flat
// array of blocks. ProseMirror (PM) is the runtime tree shape Tiptap
// expects. The two cross at the editor's `useEditor({ content })` and
// `editor.getJSON()` calls; this module is the only bidirectional
// translation point so future Tiptap upgrades only touch PM-side
// idioms in one file.
//
// **Design rules**
//
//   1. **Round-trip safety on the standard subset.** For the standard
//      blocks (text/marks/lists/headings/blockquote/code/image/
//      horizontalRule) `bodyToPmDoc(pmDocToBody(x))` MUST equal `x`.
//      This guarantee is asserted by `tests/contract.pt-bridge.test.ts`.
//   2. **Custom blocks.** `mathBlock` / `mermaid` / `musicPlayer` map to a PM
//      `blockCard` carrying `attrs.payload`. **`solution`** / **`twoColumn`**
//      serialise to nested PM nodes (`block+` / paired panes). **`footnoteDefinition`** uses the
//      same nested PM shape for full-document round-trip in tests/tools; the
//      admin page editor strips those rows before `bodyToPmDoc` and merges
//      them back on save (`@/shared/portable-text-footnote-merge`). The
//      reverse path walks nested nodes the same way as the document root.
//   3. **Keys are preserved on the way in.** The PM node's `attrs._key`
//      mirrors the PT `_key`. New nodes inserted in the editor get a
//      fresh key on save (the editor reducer fills missing `_key` via
//      `generateBlockKey()`).
//   4. **No DOM imports.** This module runs in the browser bundle but
//      stays free of `window`/`document` so SSR can sanitise PT
//      payloads through the same data path used by the editor.
//
// The custom-node payload pass-through means a fresh editor that
// hasn't yet learned to render a `musicPlayer` block still loads,
// edits text around it, and saves without losing the block. New custom
// node types only need (a) a Tiptap node spec for in-editor render +
// keyboard interactions and (b) optional bridge logic if their PM-side
// shape diverges from the generic block-card.

export type { PmDoc, PmNode, PmBlockNode, PmInlineNode, PmMark } from './types'

export { parsePortableTextBodyForEditor, bodyToPmDoc } from './pt-to-pm'
export { pmDocToBody } from './pm-to-pt'
export { arePortableTextBodiesEquivalent } from './canonicalize'
export { footnoteSyncSignature, synchronizeFootnoteIndices } from './nodes/footnote'
