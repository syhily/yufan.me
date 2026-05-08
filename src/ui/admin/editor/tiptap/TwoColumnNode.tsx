import { mergeAttributes, Node } from '@tiptap/core'

// 左右分栏在存储层是 `_type: 'twoColumn'` 的 PT，`left` / `right` 各为一层
// NonRecursiveBlock 数组；PM 侧用 `twoColumn` + 两个 `twoColumnPane` 嵌套承载，
// 往返由 `pt-bridge` 负责。

export const TwoColumnPaneNode = Node.create({
  name: 'twoColumnPane',
  group: 'twoColumnPane',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      _key: { default: '' },
      side: { default: 'left' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-pt-two-column-pane]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const side = typeof HTMLAttributes.side === 'string' && HTMLAttributes.side !== '' ? HTMLAttributes.side : 'left'
    return ['div', mergeAttributes(HTMLAttributes, { 'data-pt-two-column-pane': '', 'data-side': side }), 0]
  },
})

export const TwoColumnNode = Node.create({
  name: 'twoColumn',
  group: 'block',
  content: 'twoColumnPane twoColumnPane',
  defining: true,
  addAttributes() {
    return {
      _key: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'section[data-pt-two-column]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-pt-two-column': '' }), 0]
  },
})
