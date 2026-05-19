import type { CommentsSettings } from '@/shared/config/blog'

import { GhostSettingGroup } from '@/ui/admin/settings-ghost/GhostSettingGroup'
import { GhostSettingGroupContent } from '@/ui/admin/settings-ghost/GhostSettingGroupContent'
import { GhostSettingValue } from '@/ui/admin/settings-ghost/GhostSettingValue'
import { useSettingsCard } from '@/ui/admin/settings-ghost/useSettingsCard'
import { SettingsRow } from '@/ui/admin/settings/SettingsSection'
import { Input } from '@/ui/components/input'

interface CommentsFormProps {
  comments: CommentsSettings
}

function CommentsPaginationCard({ comments }: { comments: CommentsSettings }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    CommentsSettings,
    { size: number }
  >({
    section: 'comments',
    source: comments,
    toState: (source) => ({ size: source.comments.size }),
    fromState: (state) => ({
      comments: {
        size: state.size,
        avatar: comments.comments.avatar,
        tokenTtlSeconds: comments.comments.tokenTtlSeconds,
      },
    }),
  })

  return (
    <GhostSettingGroup
      title="评论分页"
      description="控制文章页面下方的评论列表加载行为。"
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      onSave={save}
      onCancel={cancel}
      saveState={status}
      errorMessage={errorMessage}
    >
      {isEditing ? (
        <GhostSettingGroupContent>
          <SettingsRow label="每页评论数" htmlFor="comments-size" hint="客户端「加载更多」每次抓取的根评论数量。">
            <Input
              id="comments-size"
              type="number"
              min={1}
              max={100}
              {...form.register('size', { valueAsNumber: true })}
            />
          </SettingsRow>
        </GhostSettingGroupContent>
      ) : (
        <GhostSettingGroupContent>
          <GhostSettingValue label="每页评论数" value={`${comments.comments.size}`} />
        </GhostSettingGroupContent>
      )}
    </GhostSettingGroup>
  )
}

function CommentsAvatarCard({ comments }: { comments: CommentsSettings }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    CommentsSettings,
    { avatarMirror: string; avatarSize: number }
  >({
    section: 'comments',
    source: comments,
    toState: (source) => ({
      avatarMirror: source.comments.avatar.mirror,
      avatarSize: source.comments.avatar.size,
    }),
    fromState: (state) => ({
      comments: {
        size: comments.comments.size,
        avatar: { mirror: state.avatarMirror.trim(), size: state.avatarSize },
        tokenTtlSeconds: comments.comments.tokenTtlSeconds,
      },
    }),
  })

  return (
    <GhostSettingGroup
      title="头像镜像"
      description="访客头像通过 Gravatar 协议拉取。镜像 URL 用于绕过 gravatar.com 的访问限制。"
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      onSave={save}
      onCancel={cancel}
      saveState={status}
      errorMessage={errorMessage}
    >
      {isEditing ? (
        <GhostSettingGroupContent>
          <SettingsRow
            label="Gravatar 镜像 URL"
            htmlFor="comments-avatar-mirror"
            hint="例如 https://gravatar.loli.net/avatar，结尾不带斜杠。"
          >
            <Input id="comments-avatar-mirror" type="url" {...form.register('avatarMirror')} />
          </SettingsRow>
          <SettingsRow label="头像尺寸 (px)" htmlFor="comments-avatar-size">
            <Input
              id="comments-avatar-size"
              type="number"
              min={16}
              max={512}
              {...form.register('avatarSize', { valueAsNumber: true })}
            />
          </SettingsRow>
        </GhostSettingGroupContent>
      ) : (
        <GhostSettingGroupContent>
          <GhostSettingValue label="镜像 URL" value={comments.comments.avatar.mirror} />
          <GhostSettingValue label="头像尺寸" value={`${comments.comments.avatar.size}px`} />
        </GhostSettingGroupContent>
      )}
    </GhostSettingGroup>
  )
}

function CommentsTokenCard({ comments }: { comments: CommentsSettings }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    CommentsSettings,
    { tokenTtlSeconds: number }
  >({
    section: 'comments',
    source: comments,
    toState: (source) => ({ tokenTtlSeconds: source.comments.tokenTtlSeconds }),
    fromState: (state) => ({
      comments: {
        size: comments.comments.size,
        avatar: comments.comments.avatar,
        tokenTtlSeconds: state.tokenTtlSeconds,
      },
    }),
  })

  return (
    <GhostSettingGroup
      title="匿名评论 Token"
      description="控制匿名评论者发表后可编辑自己评论的时间窗口。"
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      onSave={save}
      onCancel={cancel}
      saveState={status}
      errorMessage={errorMessage}
    >
      {isEditing ? (
        <GhostSettingGroupContent>
          <SettingsRow
            label="Token 有效期 (秒)"
            htmlFor="comments-token-ttl"
            hint="默认 1800 秒（30 分钟）。范围 60–86400 秒。"
          >
            <Input
              id="comments-token-ttl"
              type="number"
              min={60}
              max={86400}
              {...form.register('tokenTtlSeconds', { valueAsNumber: true })}
            />
          </SettingsRow>
        </GhostSettingGroupContent>
      ) : (
        <GhostSettingGroupContent>
          <GhostSettingValue
            label="Token 有效期"
            value={`${comments.comments.tokenTtlSeconds} 秒`}
            hint={`约 ${Math.round(comments.comments.tokenTtlSeconds / 60)} 分钟`}
          />
        </GhostSettingGroupContent>
      )}
    </GhostSettingGroup>
  )
}

export function CommentsForm({ comments }: CommentsFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <CommentsPaginationCard comments={comments} />
      <CommentsAvatarCard comments={comments} />
      <CommentsTokenCard comments={comments} />
    </div>
  )
}
