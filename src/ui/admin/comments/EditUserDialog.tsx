import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { idStr } from '@/shared/tools'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/admin/shadcn/components/ui/dialog'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'

// Default text colour offered to admins the moment they enable the
// override. Matches the public site's "dark navy on light badge" pairing
// so the picker lands on a sensible value rather than `#000000`.
const DEFAULT_BADGE_TEXT_COLOR = '#ffffff'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

const UPDATE_USER = API_ACTIONS.auth.updateUser

export interface EditUserDialogProps {
  comment: AdminComment | null
  onClose: () => void
  onSaved: () => void
}

export function EditUserDialog({ comment, onClose, onSaved }: EditUserDialogProps) {
  const fetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [badgeName, setBadgeName] = useState('')
  const [badgeColor, setBadgeColor] = useState('#008c95')
  // Two-state UX for the optional text-colour override:
  //   `useTextOverride === false` → send `null` to clear the override
  //                                  (server falls back to WCAG auto-pick).
  //   `useTextOverride === true`  → send the picked hex verbatim.
  // The colour picker stays mounted either way so toggling on doesn't
  // wipe the previously selected swatch — only the form submission
  // payload reads `useTextOverride`.
  const [useTextOverride, setUseTextOverride] = useState(false)
  const [badgeTextColor, setBadgeTextColor] = useState(DEFAULT_BADGE_TEXT_COLOR)

  useEffect(() => {
    if (!comment) return
    setName(comment.name)
    setEmail(comment.email)
    setLink(comment.link ?? '')
    setBadgeName(comment.badgeName ?? '')
    setBadgeColor(comment.badgeColor ?? '#008c95')
    setUseTextOverride(comment.badgeTextColor !== null && comment.badgeTextColor !== undefined)
    setBadgeTextColor(comment.badgeTextColor ?? DEFAULT_BADGE_TEXT_COLOR)
  }, [comment])

  // Hand `onSaved` to the post-submit effect via a ref so its identity
  // doesn't enter the dependency array. Without this, every render of
  // the parent (`CommentsView`) hands us a fresh `onSaved` closure,
  // which would re-fire this effect while `fetcher.data` is still set.
  // That race is exactly what produced the bug report — the parent's
  // `reload()` would be invoked tens of times in a tight loop and the
  // load fetcher would never settle, leaving the page stuck on
  // "loading" with the refresh button likewise frozen on its own
  // pending request.
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  // `fetcher.data` is the post-submit envelope. We've already handled
  // the latest value once we successfully invoke `onSaved`; record the
  // reference so a re-render (e.g. from React Strict Mode's double
  // effects, or from the parent's state churn during the close
  // animation) doesn't re-enter this branch and re-trigger reload.
  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data === lastHandled.current) return
    lastHandled.current = fetcher.data
    if (fetcher.data.error) {
      console.error('[admin] update user failed', fetcher.data.error)
      return
    }
    onSavedRef.current()
  }, [fetcher.state, fetcher.data])

  const open = comment !== null
  const submitting = fetcher.state !== 'idle'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑评论用户</DialogTitle>
          <DialogDescription>修改用户名、邮箱、链接以及徽章信息。</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!comment) return
            // Use `string | null` so we can explicitly clear the badge
            // text-colour override (sends a literal JSON `null`); empty
            // strings get filtered/normalised on the server.
            const payload: Record<string, string | null> = { userId: idStr(comment.userId), name, email }
            if (link) payload.link = link
            if (badgeName) payload.badgeName = badgeName
            if (badgeColor) payload.badgeColor = badgeColor
            // Always include `badgeTextColor` so admins can also clear a
            // previous override by unticking the checkbox.
            payload.badgeTextColor = useTextOverride ? badgeTextColor : null
            void fetcher.submit(payload, {
              method: UPDATE_USER.method,
              encType: 'application/json',
              action: UPDATE_USER.path,
            })
          }}
          className="tw:grid tw:gap-4 tw:sm:grid-cols-2"
        >
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-1">
            <Label htmlFor="edit-user-name">用户名</Label>
            <Input id="edit-user-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-1">
            <Label htmlFor="edit-user-email">邮箱</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-2">
            <Label htmlFor="edit-user-link">网站链接</Label>
            <Input
              id="edit-user-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-1">
            <Label htmlFor="edit-user-badge-name">徽章名称</Label>
            <Input
              id="edit-user-badge-name"
              type="text"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              placeholder="MOD / VIP"
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-1">
            <Label htmlFor="edit-user-badge-color">徽章颜色</Label>
            <Input
              id="edit-user-badge-color"
              type="color"
              value={badgeColor}
              onChange={(e) => setBadgeColor(e.target.value)}
              className="tw:h-9 tw:p-1"
            />
          </div>
          {/*
           * Optional badge text-colour override. Same UX as the user
           * detail page (see `UserDetailView.tsx`): a checkbox gates a
           * picker + live preview chip so the chosen swatch is visible
           * against the current background before saving.
           */}
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:col-span-2">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Checkbox
                id="edit-user-badge-text-toggle"
                checked={useTextOverride}
                onCheckedChange={(next) => setUseTextOverride(next === true)}
              />
              <Label htmlFor="edit-user-badge-text-toggle" className="tw:cursor-pointer tw:font-normal">
                自定义徽章字体颜色
              </Label>
              <span className="tw:text-muted-foreground tw:text-xs">未勾选时按背景自动选择黑/白对比色</span>
            </div>
            {useTextOverride && (
              <div className="tw:flex tw:items-center tw:gap-3">
                <Input
                  id="edit-user-badge-text-color"
                  type="color"
                  value={badgeTextColor}
                  onChange={(e) => setBadgeTextColor(e.target.value)}
                  className="tw:h-9 tw:w-20 tw:p-1"
                />
                <span
                  className="tw:inline-flex tw:items-center tw:rounded-full tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-medium"
                  style={{ backgroundColor: badgeColor || '#008c95', color: badgeTextColor }}
                >
                  {badgeName || '预览'}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="tw:sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
