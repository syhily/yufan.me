import { useEffect, useRef, useState } from 'react'

import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'

const DEBOUNCE_MS = 200

/**
 * Debounced `admin.renderMath` preview — same MathJax engine as inline math
 * (`MathInlinePanel`) and the save-time prerender pass (`display` mirrors
 * inline vs block math).
 */
export function useAdminMathPreview(
  tex: string,
  display: boolean,
): {
  previewHtml: string
  renderError: string | null
  showSpinner: boolean
} {
  const lastValidSvg = useRef('')
  const [previewSvg, setPreviewSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  const renderMath = useApiFetcher<RenderMathInput, RenderMathOutput>(API_ACTIONS.admin.renderMath, {
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
    if (tex.trim() === '') {
      lastValidSvg.current = ''
      setPreviewSvg('')
      setRenderError(null)
      return
    }
    const timer = setTimeout(() => {
      renderMath.submit({ tex, display })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // oxlint-disable-next-line exhaustive-deps
  }, [tex, display, renderMath.submit])

  const showSpinner = previewSvg === '' && renderMath.isPending
  const previewHtml = previewSvg !== '' ? previewSvg : lastValidSvg.current

  return { previewHtml, renderError, showSpinner }
}
