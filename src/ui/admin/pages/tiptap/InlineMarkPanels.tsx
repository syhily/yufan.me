import type { Editor } from '@tiptap/core'

import { getMarkRange } from '@tiptap/core'
import { CheckIcon, EraserIcon, XIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

import { generateBlockKey } from '@/shared/portable-text'
import { useAdminMathPreview } from '@/ui/admin/pages/tiptap/use-admin-math-preview'
import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

// Inline-mark editing panels that swap into the BubbleMenu when the
// active selection sits on a `mathInline` mark.
//
// Live preview uses `useAdminMathPreview` → `admin.renderMath` (same
// MathJax stack as the save-time prerender pass).

interface MathInlinePanelProps {
  editor: Editor
}

function snapshotMathInlineTex(ed: Editor): string {
  const markType = ed.state.schema.marks.mathInline
  if (markType === undefined) {
    return ''
  }
  const range = getMarkRange(ed.state.selection.$from, markType)
  if (range === undefined) {
    return (ed.getAttributes('mathInline').tex as string) ?? ''
  }
  const docSlice = ed.state.doc.textBetween(range.from, range.to, '\n')
  if (docSlice.length > 0) {
    return docSlice
  }
  const edge = Math.min(range.from + 1, Math.max(1, ed.state.doc.content.size - 1))
  const $pos = ed.state.doc.resolve(edge)
  const found = markType.isInSet($pos.marks()) ? $pos.marks().find((m) => m.type === markType) : undefined
  const fromAttrs = (found?.attrs?.tex as string) ?? ''
  return fromAttrs !== '' ? fromAttrs : ((ed.getAttributes('mathInline').tex as string) ?? '')
}

export function MathInlinePanel({ editor }: MathInlinePanelProps) {
  const [tex, setTex] = useState('')
  // TeX when this editing session began (caret last matched the formula in PM).
  // While focus sits in the textarea, PM selection can drift; cancel restores
  // this baseline and re-syncs the textarea + preview.
  const baselineTexRef = useRef('')
  const { previewHtml, renderError, showSpinner } = useAdminMathPreview(tex, false)

  // Align panel TeX with the document slice (attrs can lag behind the
  // visible text until Apply). Run after paint so the bubble menu has
  // already restored the selection from the Σ click.
  useLayoutEffect(() => {
    editor.commands.extendMarkRange('mathInline')
    const snap = snapshotMathInlineTex(editor)
    setTex(snap)
    baselineTexRef.current = snap
  }, [editor])

  const apply = () => {
    editor.chain().focus().extendMarkRange('mathInline').run()
    const prev = editor.getAttributes('mathInline') as { _key?: string }
    const nextKey = prev._key !== undefined && prev._key !== '' ? prev._key : generateBlockKey()

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: 'text',
        text: tex,
        marks: [{ type: 'mathInline', attrs: { _key: nextKey, tex } }],
      })
      .run()
    baselineTexRef.current = tex
  }
  const remove = () => {
    editor.chain().focus().extendMarkRange('mathInline').unsetMark('mathInline').run()
  }

  const cancel = () => {
    // While typing in the textarea the browser focus leaves ProseMirror; without
    // `focus()` + `extendMarkRange` the stored selection often doesn't cover the
    // whole formula, so snapshotting the doc reads the wrong TeX (cancel looked
    // like a no-op). Then jump past the mark so the bubble menu hides.
    editor.chain().focus().extendMarkRange('mathInline').run()
    let restored = snapshotMathInlineTex(editor)
    if (restored.trim() === '') {
      restored = baselineTexRef.current
    }
    setTex(restored)
    baselineTexRef.current = restored
    const caretAfterMath = editor.state.selection.to
    editor.chain().focus().setTextSelection(caretAfterMath).run()
  }

  return (
    <div className="flex w-96 flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">行内 TeX</Label>
        {renderError !== null ? <span className="text-xs text-destructive">语法错误：{renderError}</span> : null}
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        叙述里的短式子用行内；需要行内大分式时在式子前加{' '}
        <code className="rounded bg-muted px-0.5 font-mono">\displaystyle</code>
        。多行对齐请用 <span className="font-medium">/</span> 插入公式块。
      </p>
      <Textarea
        value={tex}
        onChange={(event) => setTex(event.target.value)}
        rows={2}
        className="font-mono text-xs"
        placeholder={'\\displaystyle \\frac{a}{b}'}
      />
      <div className="rounded-sm border bg-muted/30 px-2 py-1 text-sm">
        <span className="text-xs text-muted-foreground">预览：</span>
        {showSpinner ? (
          <span className="ml-2 text-xs text-muted-foreground">渲染中…</span>
        ) : (
          <span
            className="ml-2 inline-flex min-h-[1.25em] max-w-full items-center overflow-x-auto align-middle [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" type="button" onClick={cancel}>
          <XIcon /> 取消
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={remove}>
          <EraserIcon /> 移除公式
        </Button>
        <Button size="sm" type="button" onClick={apply}>
          <CheckIcon /> 应用
        </Button>
      </div>
    </div>
  )
}
