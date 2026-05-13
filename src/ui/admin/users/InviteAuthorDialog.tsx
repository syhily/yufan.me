import { SendIcon } from 'lucide-react'
import { useState } from 'react'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

const INVITE = API_ACTIONS.admin.inviteAuthor

export interface InviteAuthorDialogProps {
  onClose: () => void
  onInvited: () => void
}

export function InviteAuthorDialog({ onClose, onInvited }: InviteAuthorDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const invite = useAdminMutation<{ name: string; email: string }, { authorId: string }>(INVITE, {
    successMessage: '邀请已发送',
    onSuccess: () => {
      onInvited()
      onClose()
    },
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请作者</DialogTitle>
          <DialogDescription>
            作者可以撰写和管理自己的文章、上传图片和音乐。 受邀者将收到一封包含密码设置链接的邮件（7 天内有效）。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">姓名</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="作者姓名" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">邮箱</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="author@example.com"
            />
          </div>
          {invite.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {invite.error.message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => invite.submit({ name, email })}
            disabled={invite.loading || !name.trim() || !email.trim()}
          >
            {invite.loading ? (
              <>发送中...</>
            ) : (
              <>
                <SendIcon className="size-4" />
                发送邀请
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
