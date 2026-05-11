import { Mark, markInputRule, markPasteRule } from '@tiptap/core'

import { generateBlockKey } from '@/pt/schema'

// Mirrors `@tiptap/extension-code`: last capture group is the marked span.
// Opening `$` must not be `$$` (display math). Closing `$` must not be `$$`.
// `(?!\$)` after each delimiter avoids matching `$$` display math.
// Prefix `(^|[^\\$])` skips an opening `$` right after `\` (so `\$` in prose does not start a span).
const mathInlineInputRegex = /(^|[^\\$])\$(?!\$)([^$\n]+)\$(?!\$)$/
const mathInlinePasteRegex = /(^|[^\\$])\$(?!\$)([^$\n]+)\$(?!\$)/g

// Tiptap mark spec for `mathInline`. The PT mark def carries `tex`
// (always present), `mathml` for new KaTeX renders, and `svg` for
// historical renders. Without this Mark spec Tiptap silently strips
// the surrounding mark on any text node, which would corrupt every PT
// body containing inline math on the first save. The editor copy stays
// inert and shows the source TeX for editability.
export const MathInlineMark = Mark.create({
  name: 'mathInline',
  inclusive: false,
  addAttributes() {
    return {
      _key: { default: '' },
      tex: { default: '' },
      mathml: { default: undefined },
      svg: { default: undefined },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-math-inline': '', class: 'math math-inline', ...HTMLAttributes }, 0]
  },
  addInputRules() {
    return [
      markInputRule({
        find: mathInlineInputRegex,
        type: this.type,
        getAttributes: (match) => {
          const tex = match[match.length - 1] ?? ''
          return { tex, _key: generateBlockKey() }
        },
      }),
    ]
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: mathInlinePasteRegex,
        type: this.type,
        getAttributes: (match) => {
          const tex = match[match.length - 1] ?? ''
          return { tex, _key: generateBlockKey() }
        },
      }),
    ]
  },
})

// Footnote reference mark. Authoring insert: Toolbar / `/脚注` / typing `^ `
// (see `footnote-caret-trigger`). PT keeps defs beside prose — see merge layer.
export const FootnoteRefMark = Mark.create({
  name: 'footnoteRef',
  inclusive: true,
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
