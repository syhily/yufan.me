import { joinPaths } from '@astrojs/internal-helpers/path'

import type { CommentItem as CommentItemType } from '@/services/comments/types'

import { Html } from '@/components/ui/Html'
import { formatLocalDate } from '@/services/markdown/formatter'

export interface CommentItemProps {
  depth: number
  comment: CommentItemType
  pending?: boolean
  /** Hoisted once in the page shell so the recursive tree doesn't re-query. */
  admin: boolean
}

// Recursive comment renderer. When at depth 1 the children live inside a
// nested `<ul class="children">`; deeper nesting flattens into the outer
// list instead — this mirrors the original `.astro` component's behavior.
export function CommentItem({ comment, depth, pending, admin }: CommentItemProps) {
  const hasChildren = !!comment.children && comment.children.length > 0

  const item = (
    <li id={`user-comment-${comment.id}`} className="comment odd alt thread-odd thread-alt" data-depth={depth}>
      <article id={`div-comment-${comment.id}`} className="comment-body">
        <div
          className="comment-avatar flex-avatar"
          style={{
            backgroundImage: `url('${joinPaths(import.meta.env.SITE, '/images/default-avatar.png')}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <img
            alt={comment.name}
            src={joinPaths(import.meta.env.SITE, 'images/avatar', `${comment.userId}.png`)}
            // Inline HTML `onerror=` so it runs without hydration. React 19
            // allows unknown lowercase attrs to pass through SSR verbatim.
            {...({ onerror: "this.style.display='none'" } as { onerror: string })}
            className="avatar avatar-40 photo"
            height={40}
            width={40}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="comment-inner">
          <div className="comment-author fw-bold">
            {comment.link === '' || comment.link === null ? (
              comment.name
            ) : (
              <a href={comment.link} rel="nofollow" target="_blank">
                {comment.name}
              </a>
            )}
            {comment.badgeName && (
              <div
                className="badge badge-pill fw-bold text-wrap"
                style={{ backgroundColor: comment.badgeColor || '#008c95' }}
              >
                {comment.badgeName}
              </div>
            )}
          </div>
          {pending ? (
            <div className="comment-content text-wrap text-break">
              <p className="text-xs text-danger tip-comment-check">您的评论正在等待审核中...</p>
              <Html as="div" html={comment.content ?? ''} />
            </div>
          ) : (
            <div
              className="comment-content text-wrap text-break"
              dangerouslySetInnerHTML={{ __html: comment.content ?? '' }}
            />
          )}
          <div className="comment-footer text-xs text-muted">
            <time className="me-2">{formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm')}</time>
            <button className="comment-reply-link me-2" data-rid={comment.id}>
              回复
            </button>
            {admin && (
              <>
                <button className="comment-edit-link me-2" data-rid={comment.id}>
                  编辑
                </button>
                {comment.isPending && (
                  <button className="comment-approve-link me-2" data-rid={comment.id}>
                    通过
                  </button>
                )}
                <button className="comment-delete-link me-2" data-rid={comment.id}>
                  删除
                </button>
              </>
            )}
          </div>
        </div>
      </article>
      {hasChildren && depth === 1 && (
        <ul className="children">
          {comment.children!.map((child) => (
            <CommentItem key={child.id} comment={child} depth={depth + 1} admin={admin} />
          ))}
        </ul>
      )}
    </li>
  )

  if (hasChildren && depth !== 1) {
    return (
      <>
        {item}
        {comment.children!.map((child) => (
          <CommentItem key={child.id} comment={child} depth={depth + 1} admin={admin} />
        ))}
      </>
    )
  }

  return item
}
