import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Input } from '@/ui/admin/shadcn/components/ui/input'

interface CommentsFormProps {
  settings: BlogSettings
  csrfToken: string
}

interface FormState {
  size: number
  avatarMirror: string
  avatarSize: number
}

function snapshotFromSettings(settings: BlogSettings): FormState {
  return {
    size: settings.settings.comments.size,
    avatarMirror: settings.settings.comments.avatar.mirror,
    avatarSize: settings.settings.comments.avatar.size,
  }
}
function statesEqual(a: FormState, b: FormState): boolean {
  return a.size === b.size && a.avatarMirror === b.avatarMirror && a.avatarSize === b.avatarSize
}

export function CommentsForm({ settings, csrfToken: _csrfToken }: CommentsFormProps) {
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<FormState>(snapshot)

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !statesEqual(draft, snapshot)
  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'comments',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      comments: {
        size: draft.size,
        avatar: { mirror: draft.avatarMirror.trim(), size: draft.avatarSize },
      },
    })
  }

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection title="评论分页" description="控制文章页面下方的评论列表加载行为。">
        <FieldRow label="每页评论数" htmlFor="comments-size" hint="客户端「加载更多」每次抓取的根评论数量。">
          <Input
            id="comments-size"
            type="number"
            min={1}
            max={100}
            value={draft.size}
            onChange={(e) => setDraft((prev) => ({ ...prev, size: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="头像镜像"
        description="访客头像通过 Gravatar 协议拉取。镜像 URL 用于绕过 gravatar.com 的访问限制。"
      >
        <FieldRow
          label="Gravatar 镜像 URL"
          htmlFor="comments-avatar-mirror"
          hint="例如 https://gravatar.loli.net/avatar，结尾不带斜杠。"
        >
          <Input
            id="comments-avatar-mirror"
            type="url"
            value={draft.avatarMirror}
            onChange={(e) => setDraft((prev) => ({ ...prev, avatarMirror: e.target.value }))}
            required
          />
        </FieldRow>
        <FieldRow label="头像尺寸 (px)" htmlFor="comments-avatar-size">
          <Input
            id="comments-avatar-size"
            type="number"
            min={16}
            max={512}
            value={draft.avatarSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, avatarSize: Number.parseInt(e.target.value, 10) || 16 }))}
            required
          />
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
