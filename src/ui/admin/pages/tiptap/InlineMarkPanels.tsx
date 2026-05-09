import type { Editor } from '@tiptap/core'

import katex from 'katex'
import { ArrowDownToLineIcon, CheckIcon, EraserIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

// Inline-mark editing panels that swap into the BubbleMenu when the
// active selection sits on a `mathInline` or `footnoteRef` mark.
//
// emdash doesn't ship this — server-side MathJax is the canonical
// formula renderer, but the editor's "what does my formula look like
// right now" feedback loop wants a client-side preview. We use
// `katex` for it (cheap to bundle, works on the same TeX subset as
// MathJax) and accept a small visual mismatch with the published
// SVG: the prerender pass on save rewrites `mathInlineMarkDef.svg`,
// so the SSR output stays MathJax-canonical.

interface MathInlinePanelProps {
  editor: Editor
}

export function MathInlinePanel({ editor }: MathInlinePanelProps) {
  const initial = (editor.getAttributes('mathInline').tex as string | undefined) ?? ''
  const [tex, setTex] = useState(initial)
  const lastValid = useRef(initial)
  const previewHtml = useMemo(() => {
    try {
      const html = katex.renderToString(tex, { throwOnError: false, displayMode: false })
      lastValid.current = tex
      return html
    } catch {
      // KaTeX threw — render the last successful preview so the
      // editor doesn't flash an empty box mid-typing. The error is
      // surfaced as a small badge below.
      try {
        return katex.renderToString(lastValid.current, { throwOnError: false })
      } catch {
        return ''
      }
    }
  }, [tex])
  const hasError =
    tex.trim() !== '' &&
    (() => {
      try {
        katex.renderToString(tex, { throwOnError: true })
        return false
      } catch {
        return true
      }
    })()

  const apply = () => {
    // Re-set the mark with the updated tex. We drop the cached SVG
    // so the prerender pipeline regenerates it on the next save.
    editor.chain().focus().extendMarkRange('mathInline').updateAttributes('mathInline', { tex, svg: undefined }).run()
  }
  const remove = () => {
    editor.chain().focus().extendMarkRange('mathInline').unsetMark('mathInline').run()
  }

  return (
    <div className="flex w-96 flex-col gap-2 p-3" onMouseDown={(event) => event.preventDefault()}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">行内 TeX</Label>
        {hasError ? <span className="text-xs text-destructive">语法错误（保存仍以服务端 MathJax 为准）</span> : null}
      </div>
      <Textarea
        value={tex}
        onChange={(event) => setTex(event.target.value)}
        rows={2}
        className="font-mono text-xs"
        placeholder="\\frac{a}{b}"
      />
      <div className="rounded-sm border bg-muted/30 px-2 py-1 text-sm">
        <span className="text-xs text-muted-foreground">预览：</span>
        <span className="ml-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
      <div className="flex justify-end gap-1">
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

interface FootnoteRefPanelProps {
  editor: Editor
}

export function FootnoteRefPanel({ editor }: FootnoteRefPanelProps) {
  const attrs = editor.getAttributes('footnoteRef') as { targetKey?: string; index?: number } | undefined
  const targetKey = attrs?.targetKey ?? ''
  const index = attrs?.index ?? 0

  // The footnote definition lives in another `blockCard` node
  // somewhere in the document. We search the doc for it and, when
  // found, jump the editor selection to it. This is a low-cost scan
  // because the document is bounded by the current page body.
  const jumpToDefinition = () => {
    let foundPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (foundPos !== null) {
        return false
      }
      if (node.type.name !== 'blockCard') {
        return true
      }
      const payload = (node.attrs as { payload?: { _type?: string; _key?: string } }).payload
      if (payload?._type === 'footnoteDefinition' && payload._key === targetKey) {
        foundPos = pos
        return false
      }
      return true
    })
    if (foundPos !== null) {
      editor.chain().focus().setNodeSelection(foundPos).scrollIntoView().run()
    }
  }

  return (
    <div className="flex w-72 flex-col gap-2 p-3" onMouseDown={(event) => event.preventDefault()}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">脚注引用 #{index || '?'}</Label>
        <code className="truncate font-mono text-xs text-muted-foreground" title={targetKey}>
          {targetKey || '未指定 targetKey'}
        </code>
      </div>
      <p className="text-xs text-muted-foreground">
        引用定位到下方 <code className="font-mono">footnoteDefinition</code> 块。修改脚注序号 /
        重新挂载暂不支持，请直接编辑 PortableText 源。
      </p>
      <div className="flex justify-end">
        <Button size="sm" type="button" onClick={jumpToDefinition} disabled={targetKey === ''}>
          <ArrowDownToLineIcon /> 跳到定义
        </Button>
      </div>
    </div>
  )
}
