import { useEffect, useRef, useState } from 'react'

import type { RenderMermaidInput, RenderMermaidOutput } from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'

const DEBOUNCE_MS = 200

/** Debounced `admin.renderMermaid` preview — same `beautiful-mermaid` path as prerender on save. */
export function useAdminMermaidPreview(code: string): {
  previewHtml: string
  renderError: string | null
  showSpinner: boolean
} {
  const lastValidSvg = useRef('')
  const [previewSvg, setPreviewSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  const renderMermaid = useApiFetcher<RenderMermaidInput, RenderMermaidOutput>(API_ACTIONS.admin.renderMermaid, {
    onSuccess: (result) => {
      if (result.error !== null) {
        setRenderError(result.error)
        return
      }
      setRenderError(null)
      lastValidSvg.current = result.svg
      setPreviewSvg(result.svg)
    },
    onError: () => {
      setRenderError('渲染服务暂不可用')
    },
  })

  useEffect(() => {
    if (code.trim() === '') {
      lastValidSvg.current = ''
      setPreviewSvg('')
      setRenderError(null)
      return
    }
    const timer = setTimeout(() => {
      renderMermaid.submit({ code })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // oxlint-disable-next-line exhaustive-deps
  }, [code, renderMermaid.submit])

  const showSpinner = previewSvg === '' && renderMermaid.isPending
  const previewHtml = previewSvg !== '' ? previewSvg : lastValidSvg.current

  return { previewHtml, renderError, showSpinner }
}
