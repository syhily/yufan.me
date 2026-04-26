import type { ShouldRevalidateFunctionArgs } from 'react-router'

import { API_ACTIONS } from '@/client/api/actions'

const COMMENT_ACTION_PATHS: ReadonlySet<string> = new Set(
  Object.values(API_ACTIONS.comment).map((action) => action.path),
)

// All public routes (listings, indexes, detail pages) share the same
// revalidation policy: opt out for comment-action submissions (the comment
// island mutates its own DOM and doesn't want React Router to re-render the
// same freshly-created comment a second time), and otherwise honour the
// router's default. Plain link navigations like `/page/2 → /page/3` still
// trigger revalidation because `defaultShouldRevalidate` is `true` for them.
//
// Previously this lived under two names (`shouldRevalidateExceptCommentActions`
// and `revalidateOnNonCommentSubmissions`) with byte-identical bodies — kept
// as one to make sure the policy can't drift between detail and listing
// routes.
export function commentAwareRevalidate({ formAction, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs): boolean {
  if (isCommentAction(formAction)) return false
  return defaultShouldRevalidate
}

export function isCommentAction(formAction: string | undefined): boolean {
  const pathname = actionPathname(formAction)
  return pathname !== undefined && COMMENT_ACTION_PATHS.has(pathname)
}

function actionPathname(formAction: string | undefined): string | undefined {
  if (!formAction) return undefined
  try {
    return new URL(formAction, 'http://local.invalid').pathname
  } catch {
    const [pathname] = formAction.split('?')
    return pathname || undefined
  }
}
