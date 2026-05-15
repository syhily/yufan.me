import { useEffect, useRef, useState } from 'react'

import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { api } from '@/client/api/client'
import { useApiMutation } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'

const DEBOUNCE_MS = 200

/**
 * Debounced `admin.renderMath` preview — same KaTeX renderer as inline math
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
  const lastValidMathml = useRef('')
  const [previewMathml, setPreviewMathml] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  const renderMath = useApiMutation<RenderMathInput, RenderMathOutput>(
    (vars) => unwrap(api.admin.renders.math({ body: vars })),
    {
      onSuccess: (result) => {
        if (result.error !== null) {
          setRenderError(result.error)
          return
        }
        setRenderError(null)
        lastValidMathml.current = result.mathml
        setPreviewMathml(result.mathml)
      },
      onError: () => {
        setRenderError('渲染服务暂不可用')
      },
    },
  )

  useEffect(() => {
    if (tex.trim() === '') {
      lastValidMathml.current = ''
      setPreviewMathml('')
      setRenderError(null)
      return
    }
    const timer = setTimeout(() => {
      renderMath.mutate({ tex, display })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // oxlint-disable-next-line exhaustive-deps
  }, [tex, display, renderMath.mutate])

  const showSpinner = previewMathml === '' && renderMath.isPending
  const previewHtml = previewMathml !== '' ? previewMathml : lastValidMathml.current

  return { previewHtml, renderError, showSpinner }
}
