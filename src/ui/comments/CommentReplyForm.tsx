import { useRef, useState } from 'react'

import type { FindAvatarInput, FindAvatarOutput, ReplyCommentInput, ReplyCommentOutput } from '@/shared/api-types'
import type { CommentFormUser } from '@/shared/catalog'
import type { CommentItem as CommentItemType } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { bodyToPlainText } from '@/shared/pt/schema'
import { joinUrl } from '@/shared/urls'
import { CommentBodyEditor, EMPTY_COMMENT_BODY, isCommentBodyBlank } from '@/ui/comments/CommentBodyEditor'
import { cn } from '@/ui/lib/cn'
import { publicButtonVariants } from '@/ui/primitives/btn'
import { formControlVariants } from '@/ui/primitives/formControl'

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
  onCancel: () => void
  onReplied: (comment: CommentItemType, rid: number) => void
}

// Reply form — body is authored in the simplified Tiptap editor and
// submitted as JSON to `comment.replyComment`. The legacy
// `<fetcher.Form>` path was retired alongside the markdown pipeline:
// PortableText bodies can't be cleanly form-encoded, and the editor
// already lifts the body up as React state, so going through
// `useApiFetcher` is both simpler and lighter-weight.
export function CommentReplyForm({
  commentKey,
  csrfToken,
  onCsrfRotated,
  user,
  replyToId,
  replyTarget,
  onCancel,
  onReplied,
}: CommentReplyFormProps) {
  const [body, setBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  // Bumping `bodyKey` forces the editor to reset its internal PM doc
  // from `initialBody` (used to clear after a successful submit).
  const [bodyKey, setBodyKey] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string>(() =>
    user?.admin ? joinUrl('/images/avatar', `${user.id}.png`) : '/images/default-avatar.png',
  )

  const reply = useApiFetcher<ReplyCommentInput, ReplyCommentOutput>(API_ACTIONS.comment.replyComment, {
    onSuccess: (data) => {
      setSubmitError(null)
      if (data.csrfToken) {
        onCsrfRotated(data.csrfToken)
      }
      onReplied(data.comment, replyToId)
      // Clear the editor + remount via bodyKey bump.
      setBody(EMPTY_COMMENT_BODY)
      setBodyKey((k) => k + 1)
      formRef.current?.reset()
    },
    onError: (error) => {
      setSubmitError(error.message)
    },
  })

  const avatar = useApiFetcher<FindAvatarInput, FindAvatarOutput>(API_ACTIONS.comment.findAvatar, {
    onSuccess: (payload) => setAvatarSrc(payload.avatar),
  })

  const admin = user?.admin === true
  const isPending = reply.isPending
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

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isCommentBodyBlank(body)) {
      setSubmitError('请输入评论内容。')
      return
    }
    const form = event.currentTarget
    const data = new FormData(form)
    const name = readFormString(data, 'name') ?? user?.name ?? ''
    const email = readFormString(data, 'email') ?? user?.email ?? ''
    const link = readFormString(data, 'link') ?? ''
    const subtitle = readFormString(data, 'subtitle') ?? ''
    const payload: ReplyCommentInput = {
      page_key: commentKey,
      name,
      email,
      link: link !== '' ? link : undefined,
      body,
      csrf: csrfToken,
      rid: replyToId === 0 ? undefined : replyToId,
      subtitle: subtitle === '' ? undefined : subtitle,
    }
    setSubmitError(null)
    reply.submit(payload)
  }

  return (
    <div id="respond" className="mb-4 md:mb-6">
      <form ref={formRef} id="commentForm" className="flex flex-1" onSubmit={handleSubmit}>
        <div className="relative mr-[15px] flex size-10 shrink-0 items-center justify-center rounded-full leading-none font-semibold whitespace-nowrap max-md:mr-2.5 max-md:size-7">
          <img
            alt="头像"
            src={avatarSrc}
            className="size-full rounded-full object-cover"
            height={40}
            width={40}
            decoding="async"
          />
        </div>
        <div className="flex-1">
          <div className="relative mb-4">
            <CommentBodyEditor
              initialBody={EMPTY_COMMENT_BODY}
              bodyKey={`reply-${bodyKey}`}
              onBodyChange={setBody}
              disabled={isPending}
              className={isReplying ? 'pt-10' : undefined}
            />
            {isReplying && (
              <ReplyOverlay
                authorName={replyTarget.name}
                originalContent={bodyToPlainText(replyTarget.body).slice(0, 200).trim()}
              />
            )}
          </div>
          <CommentFormFields user={user} commentKey={commentKey} replyToId={replyToId} onEmailBlur={onEmailBlur} />
          {!admin && <CommentFormHoneypot />}
          {submitError && <div className="mb-2 text-xs text-alert">{submitError}</div>}
          <div className="flex justify-end gap-2">
            {replyToId !== 0 && (
              <button
                type="button"
                id="cancel-comment-reply-link"
                className={publicButtonVariants({ variant: 'light' })}
                // See CommentItem.tsx — keep the contenteditable focused
                // through mousedown so the editor toolbar doesn't
                // collapse between mousedown and mouseup and steal the
                // click away from this button.
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCancel}
              >
                再想想
              </button>
            )}
            <button
              name="submit"
              type="submit"
              id="submit"
              className={publicButtonVariants({ variant: 'primary' })}
              disabled={isPending}
              onMouseDown={(event) => event.preventDefault()}
            >
              {isPending ? '发表中…' : '发表评论'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function readFormString(data: FormData, name: string): string | undefined {
  const value = data.get(name)
  return typeof value === 'string' ? value : undefined
}

interface ReplyOverlayProps {
  authorName: string
  originalContent: string
}

// The "回复 @name: …" chip floats over the staged reply editor,
// pinned 0.4 rem from the top and 0.75 rem from each horizontal
// edge. `pointer-events-none` keeps the chip click-through so the
// editor below stays focusable even when the overlay extends beyond
// a single line.
const replyingToOverlayClass = cn(
  'pointer-events-none absolute top-[0.4rem] right-3 left-3 z-2',
  'flex items-center gap-1',
  'rounded-sm bg-[rgba(0,140,149,0.05)] px-2 py-[0.15rem]',
  'text-[0.9rem] text-[rgba(73,80,87,0.95)] opacity-60',
  'overflow-hidden text-ellipsis whitespace-nowrap',
)

function ReplyOverlay({ authorName, originalContent }: ReplyOverlayProps) {
  return (
    <div className={replyingToOverlayClass}>
      <span className="font-medium">回复 @{authorName}</span>
      {originalContent && <span>: {originalContent}</span>}
    </div>
  )
}

/** Off-screen honeypot: humans never see it; bots that fill every input trip schema validation. */
function CommentFormHoneypot() {
  return (
    <div className="absolute left-[-10000px] size-px overflow-hidden" aria-hidden="true">
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
    <div className="-mx-1 -mt-2 mb-4 flex flex-wrap md:-mx-2 md:-mt-4">
      {admin ? (
        <input
          className={formControlVariants()}
          placeholder={user.name}
          name="name"
          type="text"
          readOnly
          hidden
          defaultValue={user.name}
        />
      ) : (
        <div className="mt-2 box-border w-full max-w-full shrink-0 px-1 md:mt-4 md:w-1/2 md:px-2">
          <input className={formControlVariants()} placeholder="昵称" name="name" type="text" required />
        </div>
      )}
      {admin ? (
        <input
          className={formControlVariants()}
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
            className={formControlVariants()}
            name="email"
            placeholder="邮箱"
            type="email"
            required
            onBlur={onEmailBlur}
          />
        </div>
      )}
      <input hidden name="page_key" type="text" defaultValue={commentKey} />
      <input hidden name="rid" type="text" value={String(replyToId)} readOnly />
      {admin ? (
        <input
          className={formControlVariants()}
          placeholder={user.website ?? undefined}
          defaultValue={user.website ?? undefined}
          name="link"
          type="url"
          readOnly
          hidden
        />
      ) : (
        <div className="mt-2 box-border w-full max-w-full shrink-0 px-1 md:mt-4 md:px-2">
          <input className={formControlVariants()} placeholder="网址" name="link" type="url" />
        </div>
      )}
    </div>
  )
}
