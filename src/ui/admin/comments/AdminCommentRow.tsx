import { CheckIcon, EditIcon, LinkIcon, MoreHorizontalIcon, ReplyIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { AdminComment } from '@/shared/comments'

import { useFetcherResult } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { idStr } from '@/shared/tools'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/avatar'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card, CardContent } from '@/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { PortableTextBody } from '@/ui/pt/render'

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
  const config = useSiteIdentity()
  const authorHref = safeHref(comment.link)
  const truncatedUa = comment.ua ? (comment.ua.length > 50 ? `${comment.ua.substring(0, 50)}...` : comment.ua) : null

  const approveFetcher = useFetcher<ApiEnvelope<null>>()
  const deleteFetcher = useFetcher<ApiEnvelope<null>>()

  useFetcherResult(approveFetcher, { action: APPROVE, onSuccess: () => onApproved() })
  useFetcherResult(deleteFetcher, { action: DELETE, onSuccess: () => onDeleted() })

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
    <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex justify-end sm:top-4 sm:right-4 sm:bottom-auto">
      <div className="pointer-events-auto flex items-center gap-2">
        {comment.isPending && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={approveFetcher.state !== 'idle'}
            onClick={() => onConfirmApprove(submitApprove)}
            className="h-8 gap-1 px-3 text-xs sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-sm"
          >
            <CheckIcon /> 审核
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onReply}
          className="h-8 gap-1 px-3 text-xs sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-sm"
        >
          <ReplyIcon /> 回复
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon" aria-label="更多操作" className="size-8 sm:size-9">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
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
    <Card data-slot="admin-comment-row" className="relative">
      {toolbar}
      {/*
       * On mobile the toolbar sits absolute at `bottom-4 right-4`,
       * so it overlaps whatever flow content lands beneath the card.
       * Reserve a 64px bottom gutter on the content so the 32px chip
       * row never collides with the UA / IP meta line. The `sm`+
       * toolbar moves to the top-right and the gutter is no longer
       * needed, hence `sm:pb-0`.
       */}
      <CardContent className="flex gap-4 pb-16 sm:pb-0">
        <Avatar className="size-12 shrink-0">
          <AvatarImage src={`/images/avatar/${comment.userId}.png`} alt={comment.name} />
          <AvatarFallback className="bg-muted text-sm font-semibold text-muted-foreground">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          {/*
           * Identity header. We reserve right padding on `sm`+ so the
           * absolutely-positioned toolbar (top-right ~208px wide with
           * approval chip) never overlaps a long author name or
           * page-title chip. On mobile the toolbar lives below the
           * card, so no horizontal reservation is needed.
           */}
          <div className="flex min-w-0 flex-col gap-2 sm:pr-52">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
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
                  className="cursor-pointer truncate text-left font-semibold hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  {comment.name}
                </button>
                {authorHref && (
                  <a
                    href={authorHref}
                    target="_blank"
                    rel="nofollow noreferrer"
                    aria-label={`访问 ${comment.name} 的网站`}
                    className="text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
                  >
                    <LinkIcon />
                  </a>
                )}
                {comment.badgeName && (
                  <Badge
                    style={{
                      backgroundColor: comment.badgeColor || '#008c95',
                      color: comment.badgeTextColor || '#ffffff',
                    }}
                    className="border-transparent"
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
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="truncate">{comment.email}</span>
                <span>{comment.createAt ? formatLocalDate(comment.createAt, ADMIN_DATE_FORMAT, config) : ''}</span>
                {comment.pageTitle && (
                  <span className="flex min-w-0 items-center gap-0.5">
                    <span>来自：</span>
                    <button
                      type="button"
                      onClick={() => onFilterByPage(comment.pagePublicId ?? '', comment.pageTitle ?? '')}
                      title={`仅查看《${comment.pageTitle}》的评论`}
                      className="max-w-full cursor-pointer truncate text-left text-primary hover:text-primary/80 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {comment.pageTitle}
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="prose prose-sm mt-3 max-w-none text-sm leading-relaxed text-foreground">
            <PortableTextBody body={comment.body} />
          </div>
          {(truncatedUa || comment.ip) && (
            <div className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {truncatedUa && <span>UA: {truncatedUa}</span>}
              {comment.ip && <span>IP: {comment.ip}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
