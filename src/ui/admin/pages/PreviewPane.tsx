import { useDeferredValue, useMemo } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'

import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { PortableTextBody as PortableTextBodyRenderer } from '@/ui/portable-text/PortableTextBody'

export interface PreviewPaneProps {
  body: PortableTextBody
  /**
   * Page title mirrored from the metadata draft. Rendered above the
   * body so the preview's first visible line is the title, matching
   * the editor side which now hides its own title/slug strip while
   * the preview is open. Sharing the underlying `meta.title` state
   * keeps the two surfaces in sync without an extra round-trip.
   */
  title: string
  /**
   * URL slug mirrored from the metadata draft. Composed with the
   * site identity's `website` to render the full permalink right
   * under the title — gives the operator a one-glance read of where
   * the page will live publicly without leaving the editor.
   */
  slug: string
}

// Right-pane live preview. Renders the same `<PortableTextBody>`
// component the public detail route uses, so interactive children
// (MusicPlayer, Solution, etc.) work in-place — instead of going
// through a server round-trip + `dangerouslySetInnerHTML`, which
// dropped a static skeleton with no React lifecycle attached.
// `suppressMusicAutoplay` keeps the pane silent; `center` on each
// music block still affects layout like on the published page.
//
// `useDeferredValue` keeps typing responsive: the editor's body
// updates render immediately on the canvas while the preview's heavy
// re-render is deprioritised. Without it a large preview tree could
// stall keystrokes on the editor side.
export function PreviewPane({ body, title, slug }: PreviewPaneProps) {
  const deferredBody = useDeferredValue(body)
  const isStale = deferredBody !== body
  // Stable identity for the renderer's `body` prop until the deferred
  // value catches up — avoids re-walking the body on every keystroke
  // when the deferred snapshot hasn't moved yet.
  const renderedBody = useMemo(() => deferredBody, [deferredBody])

  const { website } = useSiteIdentity()
  const trimmedTitle = title.trim()
  const trimmedSlug = slug.trim()
  // `website` is stored without a trailing slash (see `seo.meta`,
  // `routes/sitemap`) and pages render at `/<slug>`. Strip any
  // accidental trailing slash before composing so a misconfigured
  // setting doesn't yield `https://example.com//foo`.
  const siteOrigin = website.replace(/\/+$/, '')
  const fullUrl = trimmedSlug === '' ? `${siteOrigin}/` : `${siteOrigin}/${trimmedSlug}`

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>实时预览</span>
        {isStale ? <span className="font-mono">渲染中…</span> : null}
      </div>
      <div className="min-h-0 grow overflow-y-auto">
        {/* Mirror of the title + slug surfaces that normally live
         *  above the editor. While live preview is on, the editor
         *  hides its own strip and the operator edits the values via
         *  the metadata sheet — but the preview still needs to show
         *  the page title for visual parity with the public detail
         *  route, AND so the first line on each side of the split
         *  view sits on the same horizontal baseline. */}
        <header className="mb-3 flex flex-col gap-1 border-b pb-3">
          <h1 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">
            {trimmedTitle === '' ? <span className="text-muted-foreground">页面标题</span> : trimmedTitle}
          </h1>
          {trimmedSlug === '' ? (
            <div className="font-mono text-xs text-muted-foreground italic">
              {siteOrigin}/<span>留空将根据标题按拼音生成</span>
            </div>
          ) : (
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs break-all text-muted-foreground hover:text-foreground hover:underline"
            >
              {fullUrl}
            </a>
          )}
        </header>
        <div className="post-content prose-blog prose prose-lg max-w-none">
          <PortableTextBodyRenderer body={renderedBody} suppressMusicAutoplay />
        </div>
      </div>
    </div>
  )
}
