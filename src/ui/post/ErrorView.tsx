import { isRouteErrorResponse } from 'react-router'

import { NotWordPressView } from '@/ui/post/NotWordPressView'

// Mirror of `NOT_WORDPRESS_STATUS_TEXT` from
// `@/server/route-helpers/wp-decoy.ts`. The contract is "a 404
// `Response` whose `statusText` is exactly this string is a WordPress
// probe decoy". The literal lives in two places so this UI module can
// live under `src/ui/` without dragging a server import (which the
// `tests/contract.boundaries.test.ts` boundary rule forbids); the
// boundary test asserts they stay in sync.
const NOT_WORDPRESS_STATUS_TEXT = 'Not WordPress'

// Shared error body for both `root.tsx` and `routes/public.layout.tsx`
// boundaries. Both call sites used to inline a near-identical
// `isRouteErrorResponse` switch: WP-decoy 404 → `<NotWordPressView />`,
// real 404 → "未找到页面 / 404", everything else → "内部错误 / 500"
// (with the dev-mode override that swaps in `error.message`).
//
// Centralising it here keeps the chrome decisions (lazy chrome vs.
// static chrome, provider re-binding, etc.) at the call sites where
// they actually differ, while guaranteeing the body cannot drift
// between the two boundaries.
export interface ErrorViewProps {
  error: unknown
}

export function ErrorView({ error }: ErrorViewProps) {
  if (isRouteErrorResponse(error) && error.status === 404 && error.statusText === NOT_WORDPRESS_STATUS_TEXT) {
    return <NotWordPressView />
  }

  let title = '内部错误'
  let description = '抱歉，网站系统出现内部错误。请刷新页面重试，或者返回上一页。'

  if (isRouteErrorResponse(error) && error.status === 404) {
    title = '未找到页面'
    description = '抱歉，没有你要找的内容...'
  } else if (import.meta.env.DEV && error instanceof Error) {
    description = error.message
  }

  return (
    <div className="flex h-(--size-empty-state) flex-auto flex-col text-center">
      <div className="my-auto">
        <h1 className="font-number text-empty-state-hero">{title === '未找到页面' ? '404' : '500'}</h1>
        <div>{description}</div>
      </div>
    </div>
  )
}
