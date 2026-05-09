import { useDeferredValue, useMemo } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'

import { PortableTextBody as PortableTextBodyRenderer } from '@/ui/portable-text/PortableTextBody'

export interface PreviewPaneProps {
  body: PortableTextBody
}

// Right-pane live preview. Renders the same `<PortableTextBody>`
// component the public detail route uses, so interactive children
// (MusicPlayer, Solution, etc.) work in-place — instead of going
// through a server round-trip + `dangerouslySetInnerHTML`, which
// dropped a static skeleton with no React lifecycle attached.
//
// `useDeferredValue` keeps typing responsive: the editor's body
// updates render immediately on the canvas while the preview's heavy
// re-render is deprioritised. Without it a large preview tree could
// stall keystrokes on the editor side.
export function PreviewPane({ body }: PreviewPaneProps) {
  const deferredBody = useDeferredValue(body)
  const isStale = deferredBody !== body
  // Stable identity for the renderer's `body` prop until the deferred
  // value catches up — avoids re-walking the body on every keystroke
  // when the deferred snapshot hasn't moved yet.
  const renderedBody = useMemo(() => deferredBody, [deferredBody])

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>实时预览</span>
        {isStale ? <span className="font-mono">渲染中…</span> : null}
      </div>
      <div className="post-content prose-blog prose prose-lg min-h-0 max-w-none grow overflow-y-auto">
        <PortableTextBodyRenderer body={renderedBody} />
      </div>
    </div>
  )
}
