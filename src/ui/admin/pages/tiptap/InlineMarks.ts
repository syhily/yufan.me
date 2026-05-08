import { Mark } from '@tiptap/core'

// Tiptap mark spec for `mathInline`. The PT mark def carries `tex`
// (always present) and `svg` (set when the editor pre-rendered the
// formula at save time). Without this Mark spec Tiptap silently strips
// the surrounding mark on any text node, which would corrupt every PT
// body containing inline math on the first save. Render it as an
// `<span class="math math-inline">` with the rendered SVG as the
// background — the editor copy stays inert and shows the source TeX
// for editability.
export const MathInlineMark = Mark.create({
  name: 'mathInline',
  inclusive: false,
  addAttributes() {
    return {
      _key: { default: '' },
      tex: { default: '' },
      svg: { default: undefined },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-math-inline': '', class: 'math math-inline', ...HTMLAttributes }, 0]
  },
})

// Footnote reference mark. The PT body keeps the definition body in a
// separate `footnoteDefinition` block; this mark is the inline anchor
// that points back at it via `targetKey`. Like `mathInline` we register
// the Mark spec so the round-trip stays clean even when the editor's
// rich UI for footnotes is still pending.
export const FootnoteRefMark = Mark.create({
  name: 'footnoteRef',
  inclusive: false,
  addAttributes() {
    return {
      _key: { default: '' },
      targetKey: { default: '' },
      index: { default: 1 },
    }
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote-ref]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', { 'data-footnote-ref': '', class: 'footnote-ref', ...HTMLAttributes }, 0]
  },
})
