import type { CommentsSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/ui/input'

interface CommentsFormProps {
  // Per-section DTO: matches `setting('blog.comments')`.
  comments: CommentsSettings
}

interface FormState {
  size: number
  avatarMirror: string
  avatarSize: number
}

export function CommentsForm({ comments }: CommentsFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    CommentsSettings,
    FormState
  >({
    section: 'comments',
    source: comments,
    toState: (source) => ({
      size: source.comments.size,
      avatarMirror: source.comments.avatar.mirror,
      avatarSize: source.comments.avatar.size,
    }),
    fromState: (state) => ({
      comments: {
        size: state.size,
        avatar: { mirror: state.avatarMirror.trim(), size: state.avatarSize },
      },
    }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="评论分页" description="控制文章页面下方的评论列表加载行为。">
        <SettingsRow label="每页评论数" htmlFor="comments-size" hint="客户端「加载更多」每次抓取的根评论数量。">
          <Input
            id="comments-size"
            type="number"
            min={1}
            max={100}
            value={draft.size}
            onChange={(e) => setDraft((prev) => ({ ...prev, size: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="头像镜像"
        description="访客头像通过 Gravatar 协议拉取。镜像 URL 用于绕过 gravatar.com 的访问限制。"
      >
        <SettingsRow
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
        </SettingsRow>
        <SettingsRow label="头像尺寸 (px)" htmlFor="comments-avatar-size">
          <Input
            id="comments-avatar-size"
            type="number"
            min={16}
            max={512}
            value={draft.avatarSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, avatarSize: Number.parseInt(e.target.value, 10) || 16 }))}
            required
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onRevert={revert}
      />
    </form>
  )
}
