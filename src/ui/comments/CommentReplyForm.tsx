import { useRef, useState } from 'react'

import type { FindAvatarInput, FindAvatarOutput, ReplyCommentOutput } from '@/client/api/action-types'
import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiAction } from '@/client/api/fetcher'
import { joinUrl } from '@/shared/urls'
import { cn } from '@/ui/lib/cn'
import { Button } from '@/ui/primitives/Button'
import { inputVariants } from '@/ui/primitives/Input'
import { Textarea } from '@/ui/primitives/Textarea'

export interface CommentReplyFormProps {
  commentKey: string
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

// Reply form goes through the shared `useApiAction` hook: the browser
// submits a regular form-encoded POST through the typed `<reply.Form>`
// component (which wraps `<fetcher.Form>`), the `defineApiAction`
// perimeter parses + validates the body via the same Zod schema as the
// JSON channel, and the response envelope drains into `onSuccess` /
// `onError` so the parent `<Comments>` island can splice the new comment
// into local state without a page refresh.
//
// Avatar lookup intentionally stays on the JSON channel (typed callback,
// fires on email blur) since it's not a form submission.
export function CommentReplyForm({
  commentKey,
  user,
  replyToId,
  replyTarget,
  textareaRef,
  onCancel,
  onReplied,
}: CommentReplyFormProps) {
  // Pin the latest `onReplied` and `replyToId` so the typed callback
  // doesn't fan out a fresh subscription on every parent rerender.
  const latest = useRef({ onReplied, replyToId })
  latest.current = { onReplied, replyToId }
  const [avatarSrc, setAvatarSrc] = useState<string>(() =>
    user?.admin ? joinUrl('/images/avatar', `${user.id}.png`) : '/images/default-avatar.png',
  )
  // Bump after each successful submission so React remounts the form,
  // dropping its uncontrolled input/textarea state along with it. This
  // keeps the textarea uncontrolled (necessary so the Chinese IME
  // composition pipeline owns intermediate keystrokes) without resorting
  // to `formRef.current?.querySelector(...).value = ''`, which mutates a
  // DOM node behind React's back.
  const [resetKey, setResetKey] = useState(0)

  const reply = useApiAction<never, ReplyCommentOutput>(API_ACTIONS.comment.replyComment, {
    onSuccess: (payload) => {
      latest.current.onReplied(payload.comment, latest.current.replyToId)
      setResetKey((value) => value + 1)
    },
  })

  const avatar = useApiAction<FindAvatarInput, FindAvatarOutput>(API_ACTIONS.comment.findAvatar, {
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
      void avatar.submit({ email })
    } else {
      setAvatarSrc('/images/default-avatar.png')
    }
  }

  return (
    <div id="respond" className="relative mb-3 md:mb-4">
      <reply.Form key={resetKey} id="commentForm" className="flex flex-auto">
        <div className="flex-avatar w-7 h-7 mr-2.5 md:w-10 md:h-10 md:mr-[0.9375rem]">
          <img
            alt="头像"
            src={avatarSrc}
            className="avatar avatar-40 photo avatar-default"
            height={40}
            width={40}
            decoding="async"
          />
        </div>
        <div className="flex-1">
          <div className="mb-3 relative">
            <Textarea
              id="content"
              name="content"
              ref={textareaRef}
              className={isReplying ? 'pt-10' : undefined}
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
          <div className="text-right">
            {replyToId !== 0 && (
              <Button tone="neutral" id="cancel-comment-reply-link" className="me-1" onClick={onCancel}>
                再想想
              </Button>
            )}
            <Button name="submit" type="submit" id="submit" disabled={isPending}>
              {isPending ? '发表中…' : '发表评论'}
            </Button>
          </div>
        </div>
      </reply.Form>
    </div>
  )
}

interface ReplyOverlayProps {
  authorName: string
  originalContent: string
}

function ReplyOverlay({ authorName, originalContent }: ReplyOverlayProps) {
  return (
    <div className="absolute top-[0.4rem] left-3 right-3 flex items-center gap-1 text-[0.9rem] text-foreground-soft/95 bg-accent/5 rounded px-2 py-[0.15rem] z-(--z-card-overlay-2) whitespace-nowrap overflow-hidden text-ellipsis opacity-60 pointer-events-none">
      <span className="font-medium">回复 @{authorName}</span>
      {originalContent && <span>: {originalContent}</span>}
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
  const fieldClass = cn(inputVariants())
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 mb-3">
      {admin ? (
        <input
          className={fieldClass}
          placeholder={user.name}
          name="name"
          type="text"
          readOnly
          hidden
          defaultValue={user.name}
        />
      ) : (
        <div className="min-w-0">
          <input className={fieldClass} placeholder="昵称" name="name" type="text" required />
        </div>
      )}
      {admin ? (
        <input
          className={fieldClass}
          name="email"
          placeholder={user.email}
          defaultValue={user.email}
          type="email"
          readOnly
          hidden
        />
      ) : (
        <div className="min-w-0">
          <input className={fieldClass} name="email" placeholder="邮箱" type="email" required onBlur={onEmailBlur} />
        </div>
      )}
      <input hidden name="page_key" type="text" defaultValue={commentKey} />
      {/* `rid` rides along with the form submission so the resource-route
          action receives the reply target without a separate hidden control. */}
      <input hidden name="rid" type="text" value={String(replyToId)} readOnly />
      {admin ? (
        <input
          className={fieldClass}
          placeholder={user.website ?? undefined}
          defaultValue={user.website ?? undefined}
          name="link"
          type="url"
          readOnly
          hidden
        />
      ) : (
        <div className="min-w-0 md:col-span-2">
          <input className={fieldClass} placeholder="网址" name="link" type="url" />
        </div>
      )}
    </div>
  )
}
