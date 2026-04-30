import { CheckIcon, EditIcon, LinkIcon, MoreHorizontalIcon, ReplyIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFetcher } from 'react-router'

import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { idStr } from '@/shared/tools'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/admin/shadcn/components/ui/avatar'
import { Badge } from '@/ui/admin/shadcn/components/ui/badge'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Card, CardContent } from '@/ui/admin/shadcn/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/admin/shadcn/components/ui/dropdown-menu'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

const ADMIN_DATE_FORMAT = 'yyyy-LL-dd HH:mm'

const APPROVE = API_ACTIONS.comment.approve
const DELETE = API_ACTIONS.comment.delete

export interface AdminCommentRowProps {
  comment: AdminComment
  onEdit: () => void
  onReply: () => void
  onEditUser: () => void
  onApproved: () => void
  onDeleted: () => void
  onConfirmApprove: (action: () => void) => void
  onConfirmDelete: (action: () => void) => void
  // The "来自：xxx" link calls back with both `pageKey` (for filtering)
  // and `pageTitle` (so the parent Combobox can hand the label to its
  // controlled state without an extra round-trip to resolve the title).
  onFilterByPage: (pageKey: string, pageTitle: string) => void
  // Click on the author name → narrow the listing to that author.
  // Same dual-arg shape as `onFilterByPage` so the parent Combobox
  // can populate both `value` (id) and `label` (name) without a
  // separate "resolve label by id" round-trip.
  onFilterByAuthor: (userId: string, name: string) => void
}

export function AdminCommentRow({
  comment,
  onEdit,
  onReply,
  onEditUser,
  onApproved,
  onDeleted,
  onConfirmApprove,
  onConfirmDelete,
  onFilterByPage,
  onFilterByAuthor,
}: AdminCommentRowProps) {
  const authorHref = safeHref(comment.link)
  const truncatedUa = comment.ua ? (comment.ua.length > 50 ? `${comment.ua.substring(0, 50)}...` : comment.ua) : null

  const approveFetcher = useFetcher<ApiEnvelope<null>>()
  const deleteFetcher = useFetcher<ApiEnvelope<null>>()

  useEffect(() => {
    if (approveFetcher.state !== 'idle' || !approveFetcher.data) return
    if (approveFetcher.data.error) {
      console.error('[admin] approve failed', approveFetcher.data.error)
      return
    }
    onApproved()
  }, [approveFetcher.state, approveFetcher.data, onApproved])

  useEffect(() => {
    if (deleteFetcher.state !== 'idle' || !deleteFetcher.data) return
    if (deleteFetcher.data.error) {
      console.error('[admin] delete failed', deleteFetcher.data.error)
      return
    }
    onDeleted()
  }, [deleteFetcher.state, deleteFetcher.data, onDeleted])

  const submitApprove = () => {
    void approveFetcher.submit(
      { rid: idStr(comment.id) },
      { method: APPROVE.method, encType: 'application/json', action: APPROVE.path },
    )
  }
  const submitDelete = () => {
    void deleteFetcher.submit(
      { rid: idStr(comment.id) },
      { method: DELETE.method, encType: 'application/json', action: DELETE.path },
    )
  }

  const initial = (comment.name || comment.email || '?').slice(0, 1).toUpperCase()

  /*
   * Action toolbar (审核 / 回复 / ⋯) is rendered as a single subtree
   * that we re-anchor between viewports via absolute positioning:
   *
   *   - sm+ : top-right of the row, aligned with the identity header.
   *   - <sm : bottom-right of the card, beneath the comment body /
   *           UA-IP block — what the user described as "右下角".
   *
   * Keeping it a single instance (instead of duplicating one toolbar
   * per viewport) preserves the DropdownMenu open state, fetcher
   * progress, and approval/deletion confirmations across resizes,
   * and avoids React re-mounting the trigger when CSS visibility
   * flips on a media-query change.
   *
   * `pointer-events-none` on the placement wrapper lets text behind
   * it (long UA strings, etc.) still be selectable; we re-enable
   * pointer events on the inner button row so clicks land normally.
   */
  const toolbar = (
    <div className="tw:pointer-events-none tw:absolute tw:right-4 tw:bottom-4 tw:z-10 tw:flex tw:justify-end tw:sm:top-4 tw:sm:right-4 tw:sm:bottom-auto">
      <div className="tw:pointer-events-auto tw:flex tw:items-center tw:gap-2">
        {comment.isPending && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={approveFetcher.state !== 'idle'}
            onClick={() => onConfirmApprove(submitApprove)}
            className="tw:h-8 tw:gap-1 tw:px-3 tw:text-xs tw:sm:h-9 tw:sm:gap-1.5 tw:sm:px-3.5 tw:sm:text-sm"
          >
            <CheckIcon /> 审核
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onReply}
          className="tw:h-8 tw:gap-1 tw:px-3 tw:text-xs tw:sm:h-9 tw:sm:gap-1.5 tw:sm:px-3.5 tw:sm:text-sm"
        >
          <ReplyIcon /> 回复
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="更多操作"
                className="tw:size-8 tw:sm:size-9"
              >
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="tw:w-40">
            <DropdownMenuItem onClick={onEdit}>
              <EditIcon /> 编辑评论
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditUser}>
              <UserIcon /> 编辑用户
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={deleteFetcher.state !== 'idle'}
              onClick={() => onConfirmDelete(submitDelete)}
            >
              <Trash2Icon /> 删除评论
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <Card data-slot="admin-comment-row" className="tw:relative">
      {toolbar}
      {/*
       * On mobile the toolbar sits absolute at `bottom-4 right-4`,
       * so it overlaps whatever flow content lands beneath the card.
       * Reserve a 64px bottom gutter on the content so the 32px chip
       * row never collides with the UA / IP meta line. The `sm`+
       * toolbar moves to the top-right and the gutter is no longer
       * needed, hence `sm:pb-0`.
       */}
      <CardContent className="tw:flex tw:gap-4 tw:pb-16 tw:sm:pb-0">
        <Avatar className="tw:size-12 tw:shrink-0">
          <AvatarImage src={`/images/avatar/${comment.userId}.png`} alt={comment.name} />
          <AvatarFallback className="tw:bg-muted tw:text-muted-foreground tw:text-sm tw:font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="tw:min-w-0 tw:flex-1">
          {/*
           * Identity header. We reserve right padding on `sm`+ so the
           * absolutely-positioned toolbar (top-right ~208px wide with
           * approval chip) never overlaps a long author name or
           * page-title chip. On mobile the toolbar lives below the
           * card, so no horizontal reservation is needed.
           */}
          <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:sm:pr-52">
            <div className="tw:min-w-0">
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                {/*
                 * The name doubles as a "filter by this author"
                 * affordance. We keep its resting style identical to
                 * the previous plain `<span>` (semibold, foreground
                 * colour) so a comment row still reads as an identity
                 * card rather than a list of links — the click target
                 * only reveals itself on hover by going teal +
                 * underline, mirroring the "来自：xxx" page-filter
                 * affordance below.
                 */}
                <button
                  type="button"
                  onClick={() => onFilterByAuthor(idStr(comment.userId), comment.name)}
                  title={`仅查看 ${comment.name} 的评论`}
                  className="tw:font-semibold tw:truncate tw:text-left tw:cursor-pointer tw:hover:text-primary tw:hover:underline tw:focus-visible:underline tw:focus-visible:text-primary tw:focus-visible:outline-none"
                >
                  {comment.name}
                </button>
                {authorHref && (
                  <a
                    href={authorHref}
                    target="_blank"
                    rel="nofollow noreferrer"
                    aria-label={`访问 ${comment.name} 的网站`}
                    className="tw:text-muted-foreground tw:hover:text-foreground"
                  >
                    <LinkIcon className="tw:size-3.5" />
                  </a>
                )}
                {comment.badgeName && (
                  <Badge
                    style={{
                      backgroundColor: comment.badgeColor || '#008c95',
                      color: comment.badgeTextColor || '#ffffff',
                    }}
                    className="tw:border-transparent"
                  >
                    {comment.badgeName}
                  </Badge>
                )}
                {comment.isPending ? (
                  <Badge variant="destructive">待审核</Badge>
                ) : (
                  <Badge variant="secondary">已审核</Badge>
                )}
              </div>
              <div className="tw:text-muted-foreground tw:mt-1 tw:flex tw:flex-wrap tw:gap-x-3 tw:gap-y-0.5 tw:text-xs">
                <span className="tw:truncate">{comment.email}</span>
                <span>{comment.createAt ? formatLocalDate(comment.createAt, ADMIN_DATE_FORMAT) : ''}</span>
                {comment.pageTitle && (
                  <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-0.5">
                    <span>来自：</span>
                    <button
                      type="button"
                      onClick={() => onFilterByPage(comment.pageKey, comment.pageTitle ?? comment.pageKey)}
                      title={`仅查看《${comment.pageTitle}》的评论`}
                      className="tw:text-primary tw:hover:text-primary/80 tw:hover:underline tw:focus-visible:underline tw:focus-visible:outline-none tw:max-w-full tw:truncate tw:text-left tw:cursor-pointer"
                    >
                      {comment.pageTitle}
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div
            className="tw:text-foreground tw:mt-3 tw:text-sm tw:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: comment.content ?? '' }}
          />
          {(truncatedUa || comment.ip) && (
            <div className="tw:text-muted-foreground tw:mt-3 tw:flex tw:flex-wrap tw:gap-x-3 tw:text-xs">
              {truncatedUa && <span>UA: {truncatedUa}</span>}
              {comment.ip && <span>IP: {comment.ip}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
