import type { Editor } from '@tiptap/core'

import { ArrowDownToLineIcon, CheckIcon, EraserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

// Inline-mark editing panels that swap into the BubbleMenu when the
// active selection sits on a `mathInline` or `footnoteRef` mark.
//
// Inline math preview: we used to bundle KaTeX client-side here for a
// "feels-instant" loop, accepting a small visual delta against the
// published SVG (which is rendered by MathJax during the save-time
// prerender pass). That delta turned out to bite — block / inline
// glyphs that look fine in KaTeX would shift visibly after publish.
//
// This panel now goes through the admin-only `admin.renderMath`
// endpoint, which calls the SAME `getMathjaxRenderer()` singleton the
// prerender pass uses. The editor preview is therefore byte-identical
// to what the publish pipeline writes — WYSIWYG by construction. The
// trade-off is a network round-trip per debounced keystroke, which on
// a colocated SSR is sub-50ms and well below the typing cadence; the
// debounce below caps the actual request rate to ~3-4/s during heavy
// editing. The MathJax engine is a process-level singleton on the
// server side so only the very first request in a process pays the
// ~100ms boot cost.

interface MathInlinePanelProps {
  editor: Editor
}

// Debounce window for typing → server render. 200ms feels instant for
// human typing (typists rarely keep pressing keys faster than ~5/s)
// while still consolidating bursts ("\\frac{a}{b}" is 11 keystrokes
// → one network call instead of eleven). Tune up if the SSR proves
// expensive under contended workloads.
const DEBOUNCE_MS = 200

export function MathInlinePanel({ editor }: MathInlinePanelProps) {
  const initial = (editor.getAttributes('mathInline').tex as string | undefined) ?? ''
  const [tex, setTex] = useState(initial)
  // Last server response that successfully rendered. Held outside React
  // state so the in-flight render path doesn't churn on every keystroke;
  // the preview pane reads this through a ref + a small state echo
  // (`previewSvg`) that only updates when the server returns.
  const lastValidSvg = useRef('')
  const [previewSvg, setPreviewSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  const renderMath = useApiFetcher<RenderMathInput, RenderMathOutput>(API_ACTIONS.admin.renderMath, {
    onSuccess: (result) => {
      if (result.error !== null) {
        // MathJax refused the input. Keep showing the last successful
        // SVG so the preview pane never flashes empty mid-typing,
        // and surface the error message in the badge.
        setRenderError(result.error)
        return
      }
      setRenderError(null)
      lastValidSvg.current = result.svg
      setPreviewSvg(result.svg)
    },
    onError: () => {
      // Network / 500 error — surface a generic message but keep the
      // last good preview visible.
      setRenderError('渲染服务暂不可用')
    },
  })

  // Debounce keystrokes into a single server call. The dependency is
  // `tex` (and the stable `submit`); the cleanup cancels the pending
  // timer so a fast typer never queues up multiple requests.
  useEffect(() => {
    if (tex.trim() === '') {
      // Empty field → wipe the preview immediately. No server call
      // needed; the endpoint's no-op short-circuit would do the same
      // thing but the round-trip is wasted work.
      lastValidSvg.current = ''
      setPreviewSvg('')
      setRenderError(null)
      return
    }
    const timer = setTimeout(() => {
      renderMath.submit({ tex, display: false })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // `renderMath.submit` is `useCallback`-stable across renders
    // per `useApiFetcher` (keyed only on the action's method + path),
    // so depending on `renderMath.submit` is correct and minimal.
    // The linter wants us to include the whole `renderMath` object,
    // which would re-run the effect every render and defeat the
    // debounce.
    // oxlint-disable-next-line exhaustive-deps
  }, [tex, renderMath.submit])

  const apply = () => {
    // Re-set the mark with the updated tex. We drop the cached SVG so
    // the save-time prerender pipeline regenerates it from the same
    // source the preview just verified.
    editor.chain().focus().extendMarkRange('mathInline').updateAttributes('mathInline', { tex, svg: undefined }).run()
  }
  const remove = () => {
    editor.chain().focus().extendMarkRange('mathInline').unsetMark('mathInline').run()
  }

  // While the very first render is in flight (no previous successful
  // SVG yet) show a small placeholder so the preview pane is never
  // structurally empty — keeps the panel height stable across renders.
  const showSpinner = previewSvg === '' && renderMath.isPending
  const previewHtml = previewSvg !== '' ? previewSvg : lastValidSvg.current

  return (
    <div className="flex w-96 flex-col gap-2 p-3" onMouseDown={(event) => event.preventDefault()}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">行内 TeX</Label>
        {renderError !== null ? <span className="text-xs text-destructive">语法错误：{renderError}</span> : null}
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
        {showSpinner ? (
          <span className="ml-2 text-xs text-muted-foreground">渲染中…</span>
        ) : (
          <span className="ml-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
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
