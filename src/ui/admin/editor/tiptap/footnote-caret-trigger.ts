import { Extension, InputRule } from '@tiptap/core'

import { canInsertFootnoteMark } from '@/ui/admin/editor/tiptap/insert-inline-footnote'

// Footnote insert shortcut: caret + ASCII space, aligned with backtick code and $ math.
// A backslash before the caret suppresses the trigger (same spirit as \$ for math).

export const FOOTNOTE_INSERT_TRIGGER_REGEX = /(^|[^\\])(\^ )$/

export const FootnoteCaretTriggerExtension = Extension.create({
  name: 'footnoteCaretTrigger',
  addInputRules() {
    const editor = this.editor
    return [
      new InputRule({
        find: FOOTNOTE_INSERT_TRIGGER_REGEX,
        handler: ({ chain, match, range }) => {
          if (!canInsertFootnoteMark(editor)) {
            return null
          }
          const prefix = match[1] ?? ''
          if ((match[2] ?? '') !== '^ ') {
            return null
          }
          const deleteFrom = range.from + prefix.length
          chain().focus().deleteRange({ from: deleteFrom, to: range.to }).run()
          editor.storage.editorActions?.openFootnoteDialog?.()
        },
      }),
    ]
  },
})
