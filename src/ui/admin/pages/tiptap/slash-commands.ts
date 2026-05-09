import type { Range } from '@tiptap/core'
import type { Editor } from '@tiptap/react'

import {
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ImageIcon,
  ListIcon,
  ListTreeIcon,
  ListOrderedIcon,
  MinusIcon,
  Music2Icon,
  QuoteIcon,
  SigmaIcon,
  type LucideIcon,
  TableIcon,
  Type as TypeIcon,
  WorkflowIcon,
} from 'lucide-react'

import type { Block } from '@/shared/portable-text'

import { generateBlockKey } from '@/shared/portable-text'
import { dispatchOpenImagePicker, dispatchOpenMusicPicker } from '@/ui/admin/pages/tiptap/editor-events'

// Slash menu command catalogue. Each entry knows how to filter
// itself against a query string + how to mutate the editor when
// chosen. The list is intentionally flat (one-per-action) so the
// suggestion dropdown can walk it linearly without per-group
// rendering — emdash had a similar layout and it kept the menu
// keyboard-navigable without needing arrow-down-to-section UX.

export interface SlashCommand {
  /** Stable identifier (used for React keys + tests). */
  id: string
  /** Title shown as the primary line in the menu. */
  title: string
  /** Sub-line description shown beneath the title. */
  description: string
  /** Lucide icon component. */
  icon: LucideIcon
  /** Lower-case alternative search terms (English + Chinese). */
  aliases: readonly string[]
  /** Handler invoked when the user selects this command. */
  command: (props: { editor: Editor; range: Range }) => void
}

// Insert a PortableText custom block at the slash range. We piggy-
// back on the bridge's `blockCard` PM node so a single round-trip
// path stays authoritative — consistent with `PageBodyEditor`'s
// existing `insertCustomBlock` helper.
function insertCustomBlock(editor: Editor, range: Range, payload: Block): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: 'blockCard',
      attrs: { _key: payload._key, _ptType: payload._type, payload },
    })
    .run()
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'paragraph',
    title: '正文',
    description: '清除当前块格式',
    icon: TypeIcon,
    aliases: ['paragraph', 'text', '正文', 'p'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph').run()
    },
  },
  {
    id: 'h2',
    title: '二级标题',
    description: 'H2',
    icon: Heading2Icon,
    aliases: ['h2', 'heading2', 'title', '二级标题', '标题2'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    id: 'h3',
    title: '三级标题',
    description: 'H3',
    icon: Heading3Icon,
    aliases: ['h3', 'heading3', '三级标题', '标题3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    id: 'h4',
    title: '四级标题',
    description: 'H4',
    icon: Heading4Icon,
    aliases: ['h4', 'heading4', '四级标题', '标题4'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run()
    },
  },
  {
    id: 'bullet-list',
    title: '无序列表',
    description: '点状列表',
    icon: ListIcon,
    aliases: ['ul', 'bullet', 'list', '无序列表', 'li'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    id: 'ordered-list',
    title: '有序列表',
    description: '编号列表',
    icon: ListOrderedIcon,
    aliases: ['ol', 'ordered', 'number', '有序列表', '编号'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    id: 'blockquote',
    title: '引用',
    description: '块引用',
    icon: QuoteIcon,
    aliases: ['quote', 'blockquote', '引用'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    id: 'code-block',
    title: '代码块',
    description: 'Shiki 高亮',
    icon: CodeIcon,
    aliases: ['code', 'codeblock', 'pre', '代码', '代码块'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    id: 'horizontal-rule',
    title: '分隔线',
    description: '水平分隔',
    icon: MinusIcon,
    aliases: ['hr', 'rule', 'divider', '分隔线'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    id: 'image',
    title: '图片',
    description: '从图库选择',
    icon: ImageIcon,
    aliases: ['image', 'img', 'picture', '图片', '图'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      dispatchOpenImagePicker()
    },
  },
  {
    id: 'music',
    title: '音乐',
    description: '插入网易云播放器',
    icon: Music2Icon,
    aliases: ['music', 'audio', 'song', '音乐', '播放器'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      dispatchOpenMusicPicker()
    },
  },
  {
    id: 'table',
    title: '表格',
    description: '插入 3 × 3 含表头',
    icon: TableIcon,
    aliases: ['table', 'grid', '表格', '表'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    id: 'math-block',
    title: '公式块',
    description: 'TeX block math',
    icon: SigmaIcon,
    aliases: ['math', 'mathblock', 'tex', 'katex', '公式', '数学'],
    command: ({ editor, range }) => {
      insertCustomBlock(editor, range, {
        _type: 'mathBlock',
        _key: generateBlockKey(),
        tex: 'a^2 + b^2 = c^2',
      })
    },
  },
  {
    id: 'mermaid',
    title: 'Mermaid 流程图',
    description: '声明式流程图 / 时序图',
    icon: WorkflowIcon,
    aliases: ['mermaid', 'diagram', 'flow', '流程图'],
    command: ({ editor, range }) => {
      insertCustomBlock(editor, range, {
        _type: 'mermaid',
        _key: generateBlockKey(),
        code: 'graph TD\n  A --> B',
      })
    },
  },
  {
    id: 'solution',
    title: '解答块',
    description: '题解 / 提示（内部可排版，与引用块相同）',
    icon: ListTreeIcon,
    aliases: ['solution', 'hint', 'answer', '解答', '题解', '提示'],
    command: ({ editor, range }) => {
      const key = generateBlockKey()
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'solution',
          attrs: { _key: key },
          content: [
            {
              type: 'paragraph',
              attrs: { _key: generateBlockKey() },
              content: [{ type: 'text', text: '在此处填写解答步骤' }],
            },
          ],
        })
        .run()
    },
  },
  {
    id: 'footnote',
    title: '脚注定义',
    description: '插入页底脚注块',
    icon: SigmaIcon,
    aliases: ['footnote', 'fn', '脚注'],
    command: ({ editor, range }) => {
      insertCustomBlock(editor, range, {
        _type: 'footnoteDefinition',
        _key: generateBlockKey(),
        index: 1,
        children: [
          {
            _type: 'block',
            _key: generateBlockKey(),
            style: 'normal',
            children: [{ _type: 'span', _key: generateBlockKey(), text: '脚注内容' }],
          },
        ],
      })
    },
  },
]

/**
 * Filter the slash command catalogue against a query. Matching is
 * case-insensitive against the title + aliases. An empty query
 * returns the whole catalogue, which lets the menu open immediately
 * after `/` and let the user arrow through it.
 */
export function filterSlashCommands(query: string): readonly SlashCommand[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed === '') {
    return SLASH_COMMANDS
  }
  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.title.toLowerCase().includes(trimmed)) {
      return true
    }
    return cmd.aliases.some((alias) => alias.toLowerCase().includes(trimmed))
  })
}
