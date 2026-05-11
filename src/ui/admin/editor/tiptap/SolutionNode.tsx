import { mergeAttributes, Node } from '@tiptap/core'

// 解答块在存储层是 `_type: 'solution'` 的 PT，语义上等价于带「解：」装饰的块引用：
// 内部允许与普通文档相同的块（段落、标题、列表、表格、公式块等），由 `pt-bridge`
// 与顶层块共用同一套 PM ↔ PT 转换。

export const SolutionNode = Node.create({
  name: 'solution',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      _key: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'blockquote[data-pt-solution]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-pt-solution': '' }), 0]
  },
})
