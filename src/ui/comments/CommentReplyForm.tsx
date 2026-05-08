import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { FindAvatarInput, FindAvatarOutput, ReplyCommentOutput } from '@/shared/api-types'
import type { CommentFormUser } from '@/shared/catalog'
import type { CommentItem as CommentItemType } from '@/shared/comments'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { joinUrl } from '@/shared/urls'
import { cn } from '@/ui/lib/cn'
import { btnBase, btnLight, btnPrimary } from '@/ui/primitives/btn'
import { formControlInputClass, formControlTextareaClass } from '@/ui/primitives/formControl'

export interface CommentReplyFormProps {
  commentKey: string
  /** Matches `csrf-token` cookie; server returns a fresh token after each successful reply. */
  csrfToken: string
  onCsrfRotated: (token: string) => void
  user?: CommentFormUser
  /** Currently active reply target id; 0 means top-level reply. */
  replyToId: number
  /** Resolved reply target (for the quoted-author overlay). */
  replyTarget?: CommentItemType
  /** External ref so the parent `<Comments>` island can focus the textarea. */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onCancel: () => void
  onReplied: (comment: CommentItemType, rid: number) => void
}

const REPLY = API_ACTIONS.comment.replyComment

// Reply form goes through React Router's `<fetcher.Form>` pipeline:
// the browser submits a regular form-encoded POST to the resource route, the
// `defineApiAction` perimeter parses + validates the body via the same Zod
// schema as the legacy JSON channel, and the response envelope flows back
// through `fetcher.data` so the parent `<Comments>` island can splice the new
// comment into local state without a page refresh.
//
// Avatar lookup intentionally stays on the JSON channel (typed callback,
// fires on email blur) since it's not a form submission.
export function CommentReplyForm({
  commentKey,
  csrfToken,
  onCsrfRotated,
  user,
  replyToId,
  replyTarget,
  textareaRef,
  onCancel,
  onReplied,
}: CommentReplyFormProps) {
  const fetcher = useFetcher<ApiEnvelope<ReplyCommentOutput>>()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string>(() =>
    user?.admin ? joinUrl('/images/avatar', `${user.id}.png`) : '/images/default-avatar.png',
  )

  // Pin the latest callbacks so the result-draining effect doesn't fan out a
  // fresh subscription on every parent rerender.
  const latest = useRef({ onReplied, onCsrfRotated, replyToId })
  latest.current = { onReplied, onCsrfRotated, replyToId }

  // Drain `fetcher.data` once per response, then clear the textarea so the
  // next submission starts empty.
  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    const data = fetcher.data
    if (fetcher.state !== 'idle' || !data) {
      return
    }
    if (data === lastHandled.current) {
      return
    }
    lastHandled.current = data
    if (data.error) {
      console.error(`[api] ${REPLY.method} ${REPLY.path} failed`, data.error)
      return
    }
    if (data.data === undefined) {
      return
    }
    if (data.data.csrfToken) {
      latest.current.onCsrfRotated(data.data.csrfToken)
    }
    latest.current.onReplied(data.data.comment, latest.current.replyToId)
    const textarea = formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="content"]')
    if (textarea) {
      textarea.value = ''
    }
  }, [fetcher.state, fetcher.data])

  const avatar = useApiFetcher<FindAvatarInput, FindAvatarOutput>(API_ACTIONS.comment.findAvatar, {
    onSuccess: (payload) => setAvatarSrc(payload.avatar),
  })

  const admin = user?.admin === true
  const isPending = fetcher.state !== 'idle'
  const isReplying = replyToId !== 0 && replyTarget !== undefined

  const onEmailBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (admin) {
      return
    }
    const email = event.currentTarget.value
    if (email && email.includes('@')) {
      avatar.submit({ email })
    } else {
      setAvatarSrc('/images/default-avatar.png')
    }
  }

  return (
    <div id="respond" className="comment-respond mb-4 md:mb-6">
      <fetcher.Form
        ref={formRef}
        method={REPLY.method}
        action={REPLY.path}
        id="commentForm"
        className="comment-form flex flex-1"
      >
        <input name="csrf" type="hidden" value={csrfToken} />
        <div className="comment-from-avatar relative mr-[15px] flex size-10 shrink-0 items-center justify-center rounded-full leading-none font-semibold whitespace-nowrap max-md:mr-2.5 max-md:size-7">
          <img
            alt="头像"
            src={avatarSrc}
            className="comment-avatar-default size-full rounded-full object-cover"
            height={40}
            width={40}
            decoding="async"
          />
        </div>
        <div className="comment-from-input flex-1">
          <div className="comment-form-text relative mb-4">
            <textarea
              id="content"
              name="content"
              ref={textareaRef}
              className={cn(
                formControlTextareaClass,
                // 40 px (= 2.5 rem) top inset reserves room for the
                // absolutely-positioned `<ReplyOverlay>` chip rendered
                // just below this textarea when a reply is staged.
                // The `comment-reply-textarea` literal stays as a
                // WP-compat marker even though the partial rule is
                // gone — downstream templates can still hook on it.
                isReplying && 'comment-reply-textarea pt-10',
              )}
              rows={3}
              required
            />
            {isReplying && (
              <ReplyOverlay
                authorName={replyTarget.name}
                originalContent={(replyTarget.content ?? '').replace(/<[^>]+>/g, '').trim()}
              />
            )}
          </div>
          <CommentFormFields user={user} commentKey={commentKey} replyToId={replyToId} onEmailBlur={onEmailBlur} />
          {!admin && <CommentFormHoneypot />}
          <div className="form-submit flex justify-end gap-2">
            {replyToId !== 0 && (
              <button type="button" id="cancel-comment-reply-link" className={cn(btnBase, btnLight)} onClick={onCancel}>
                再想想
              </button>
            )}
            <button name="submit" type="submit" id="submit" className={cn(btnBase, btnPrimary)} disabled={isPending}>
              {isPending ? '发表中…' : '发表评论'}
            </button>
          </div>
        </div>
      </fetcher.Form>
    </div>
  )
}

interface ReplyOverlayProps {
  authorName: string
  originalContent: string
}

// The "回复 @name: …" chip floats over the staged reply textarea,
// pinned 0.4 rem from the top and 0.75 rem from each horizontal
// edge. The brand-tinted background (#008c95 @ 5 %) and ink-muted
// text (#495057 @ 95 %) are arbitrary literals here because they
// have a single consumer; if a second site location ever needs the
// `tailwind.css @theme inline` as `--color-overlay-brand` /
// `--color-ink-muted-soft`. `pointer-events-none` keeps the chip
// click-through so the textarea below stays interactive even when
// the overlay extends beyond a single line.
const replyingToOverlayClass = cn(
  'replying-to-overlay',
  'pointer-events-none absolute top-[0.4rem] right-3 left-3 z-2',
  'flex items-center gap-1',
  'rounded-sm bg-[rgba(0,140,149,0.05)] px-2 py-[0.15rem]',
  'text-[0.9rem] text-[rgba(73,80,87,0.95)] opacity-60',
  'overflow-hidden text-ellipsis whitespace-nowrap',
)

function ReplyOverlay({ authorName, originalContent }: ReplyOverlayProps) {
  return (
    <div className={replyingToOverlayClass}>
      <span className="replying-name font-medium">回复 @{authorName}</span>
      {originalContent && <span className="replying-content">: {originalContent}</span>}
    </div>
  )
}

/** Off-screen honeypot: humans never see it; bots that fill every input trip schema validation. */
function CommentFormHoneypot() {
  // `left-[-10000px]` parks the input far off-screen instead of
  // `display: none` (which screen-reader-equipped bots could detect
  // and skip). `size-px` collapses the box to 1×1 so even probes
  // that ignore `left` still get nothing useful.
  return (
    <div className="comment-form-honeypot absolute left-[-10000px] size-px overflow-hidden" aria-hidden="true">
      <label htmlFor="comment-subtitle">Subtitle</label>
      <input id="comment-subtitle" name="subtitle" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  )
}

interface CommentFormFieldsProps {
  user?: CommentFormUser
  commentKey: string
  replyToId: number
  onEmailBlur: (event: React.FocusEvent<HTMLInputElement>) => void
}

function CommentFormFields({ user, commentKey, replyToId, onEmailBlur }: CommentFormFieldsProps) {
  const admin = user?.admin === true
  return (
    <div className="comment-form-info -mx-1 -mt-2 mb-4 flex flex-wrap md:-mx-2 md:-mt-4">
      {admin ? (
        <input
          className={formControlInputClass}
          placeholder={user.name}
          name="name"
          type="text"
          readOnly
          hidden
          defaultValue={user.name}
        />
      ) : (
        <div className="mt-2 box-border w-full max-w-full shrink-0 px-1 md:mt-4 md:w-1/2 md:px-2">
          <input className={formControlInputClass} placeholder="昵称" name="name" type="text" required />
        </div>
      )}
      {admin ? (
        <input
          className={formControlInputClass}
          name="email"
          placeholder={user.email}
          defaultValue={user.email}
          type="email"
          readOnly
          hidden
        />
      ) : (
        <div className="mt-2 box-border w-full max-w-full shrink-0 px-1 md:mt-4 md:w-1/2 md:px-2">
          <input
            className={formControlInputClass}
            name="email"
            placeholder="邮箱"
            type="email"
            required
            onBlur={onEmailBlur}
          />
        </div>
      )}
      <input hidden name="page_key" type="text" defaultValue={commentKey} />
      {/* `rid` rides along with the form submission so the resource-route
          action receives the reply target without a separate hidden control. */}
      <input hidden name="rid" type="text" value={String(replyToId)} readOnly />
      {admin ? (
        <input
          className={formControlInputClass}
          placeholder={user.website ?? undefined}
          defaultValue={user.website ?? undefined}
          name="link"
          type="url"
          readOnly
          hidden
        />
      ) : (
        <div className="mt-2 box-border w-full max-w-full shrink-0 px-1 md:mt-4 md:px-2">
          <input className={formControlInputClass} placeholder="网址" name="link" type="url" />
        </div>
      )}
    </div>
  )
}
