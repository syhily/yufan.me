import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { FindAvatarInput, FindAvatarOutput, ReplyCommentOutput } from '@/client/api/action-types'
import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType } from '@/server/comments/types'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { joinUrl } from '@/shared/urls'

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

  // Pin the latest `onReplied` and `replyToId` so the result-draining effect
  // doesn't fan out a fresh subscription on every parent rerender.
  const latest = useRef({ onReplied, replyToId })
  latest.current = { onReplied, replyToId }

  // Drain `fetcher.data` once per response, then clear the textarea so the
  // next submission starts empty.
  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    const data = fetcher.data
    if (fetcher.state !== 'idle' || !data) return
    if (data === lastHandled.current) return
    lastHandled.current = data
    if (data.error) {
      console.error(`[api] ${REPLY.method} ${REPLY.path} failed`, data.error)
      return
    }
    if (data.data === undefined) return
    latest.current.onReplied(data.data.comment, latest.current.replyToId)
    const textarea = formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="content"]')
    if (textarea) textarea.value = ''
  }, [fetcher.state, fetcher.data])

  const avatar = useApiFetcher<FindAvatarInput, FindAvatarOutput>(API_ACTIONS.comment.findAvatar, {
    onSuccess: (payload) => setAvatarSrc(payload.avatar),
  })

  const admin = user?.admin === true
  const isPending = fetcher.state !== 'idle'
  const isReplying = replyToId !== 0 && replyTarget !== undefined

  const onEmailBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (admin) return
    const email = event.currentTarget.value
    if (email && email.includes('@')) {
      avatar.submit({ email })
    } else {
      setAvatarSrc('/images/default-avatar.png')
    }
  }

  return (
    <div id="respond" className="comment-respond mb-3 mb-md-4">
      <fetcher.Form ref={formRef} method={REPLY.method} action={REPLY.path} id="commentForm" className="comment-form">
        <div className="comment-from-avatar flex-avatar">
          <img
            alt="头像"
            src={avatarSrc}
            className="avatar avatar-40 photo avatar-default"
            height={40}
            width={40}
            decoding="async"
          />
        </div>
        <div className="comment-from-input flex-fill">
          <div className="comment-form-text mb-3 position-relative">
            <textarea
              id="content"
              name="content"
              ref={textareaRef}
              className={isReplying ? 'form-control comment-reply-textarea' : 'form-control'}
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
          <div className="form-submit text-end">
            {replyToId !== 0 && (
              <button type="button" id="cancel-comment-reply-link" className="btn btn-light me-1" onClick={onCancel}>
                再想想
              </button>
            )}
            <button name="submit" type="submit" id="submit" className="btn btn-primary" disabled={isPending}>
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

function ReplyOverlay({ authorName, originalContent }: ReplyOverlayProps) {
  return (
    <div className="replying-to-overlay">
      <span className="replying-name">回复 @{authorName}</span>
      {originalContent && <span className="replying-content">: {originalContent}</span>}
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
    <div className="comment-form-info row g-2 g-md-3 mb-3">
      {admin ? (
        <input
          className="form-control"
          placeholder={user.name}
          name="name"
          type="text"
          readOnly
          hidden
          defaultValue={user.name}
        />
      ) : (
        <div className="col">
          <input className="form-control" placeholder="昵称" name="name" type="text" required />
        </div>
      )}
      {admin ? (
        <input
          className="form-control"
          name="email"
          placeholder={user.email}
          defaultValue={user.email}
          type="email"
          readOnly
          hidden
        />
      ) : (
        <div className="col-12 col-md-6">
          <input className="form-control" name="email" placeholder="邮箱" type="email" required onBlur={onEmailBlur} />
        </div>
      )}
      <input hidden name="page_key" type="text" defaultValue={commentKey} />
      {/* `rid` rides along with the form submission so the resource-route
          action receives the reply target without a separate hidden control. */}
      <input hidden name="rid" type="text" value={String(replyToId)} readOnly />
      {admin ? (
        <input
          className="form-control"
          placeholder={user.website ?? undefined}
          defaultValue={user.website ?? undefined}
          name="link"
          type="url"
          readOnly
          hidden
        />
      ) : (
        <div className="col-12">
          <input className="form-control" placeholder="网址" name="link" type="url" />
        </div>
      )}
    </div>
  )
}
