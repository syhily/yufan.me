import type { RateLimitSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'

// Bucket bounds (mirrored from `@/server/settings/schema.ts` so the
// admin form's `min` / `max` attributes match the server validator
// without re-reaching for the schema at render time).
const BOUNDS = {
  windowSeconds: { min: 60, max: 60 * 60 * 24 },
  maxAttempts: { min: 1, max: 1000 },
} as const

interface RateLimitFormProps {
  // Per-section DTO: matches `setting('blog.rateLimit')`.
  rateLimit: RateLimitSettings
}

interface BucketState {
  windowSeconds: number
  maxAttempts: number
}

interface FormState {
  signInIp: BucketState
  commentPostIp: BucketState
  commentPostEmail: BucketState
  likeIncreaseIp: BucketState
  inviteIp: BucketState
  passwordResetIp: BucketState
  passwordResetTarget: BucketState
}

type BucketKey = keyof FormState

interface BucketCardProps {
  title: string
  description: string
  windowFieldId: string
  attemptsFieldId: string
  bucket: BucketState
  onChangeWindow: (value: number) => void
  onChangeAttempts: (value: number) => void
  windowHint: string
  attemptsHint: string
}

// One card per bucket — the matrix is small (4 rows × 2 fields) and
// composing it out of `<SettingsSection>` keeps the visual rhythm
// identical to every other settings page (cache, sidebar, …) even
// though every card has the same two fields. Adding a fifth bucket
// later is a one-line `<RateLimitBucketCard …/>` block.
function RateLimitBucketCard({
  title,
  description,
  windowFieldId,
  attemptsFieldId,
  bucket,
  onChangeWindow,
  onChangeAttempts,
  windowHint,
  attemptsHint,
}: BucketCardProps) {
  return (
    <SettingsSection title={title} description={description}>
      <SettingsRow label="时间窗口（秒）" htmlFor={windowFieldId} hint={windowHint}>
        <Input
          id={windowFieldId}
          type="number"
          min={BOUNDS.windowSeconds.min}
          max={BOUNDS.windowSeconds.max}
          value={bucket.windowSeconds}
          onChange={(e) => onChangeWindow(Number.parseInt(e.target.value, 10) || BOUNDS.windowSeconds.min)}
        />
      </SettingsRow>
      <SettingsRow label="窗口内最多次数" htmlFor={attemptsFieldId} hint={attemptsHint}>
        <Input
          id={attemptsFieldId}
          type="number"
          min={BOUNDS.maxAttempts.min}
          max={BOUNDS.maxAttempts.max}
          value={bucket.maxAttempts}
          onChange={(e) => onChangeAttempts(Number.parseInt(e.target.value, 10) || BOUNDS.maxAttempts.min)}
        />
      </SettingsRow>
    </SettingsSection>
  )
}

export function RateLimitForm({ rateLimit }: RateLimitFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    RateLimitSettings,
    FormState
  >({
    section: 'rateLimit',
    source: rateLimit,
    toState: (source) => ({
      signInIp: { ...source.signInIp },
      commentPostIp: { ...source.commentPostIp },
      commentPostEmail: { ...source.commentPostEmail },
      likeIncreaseIp: { ...source.likeIncreaseIp },
      inviteIp: { ...source.inviteIp },
      passwordResetIp: { ...source.passwordResetIp },
      passwordResetTarget: { ...source.passwordResetTarget },
    }),
    fromState: (state) => ({
      signInIp: { ...state.signInIp },
      commentPostIp: { ...state.commentPostIp },
      commentPostEmail: { ...state.commentPostEmail },
      likeIncreaseIp: { ...state.likeIncreaseIp },
      inviteIp: { ...state.inviteIp },
      passwordResetIp: { ...state.passwordResetIp },
      passwordResetTarget: { ...state.passwordResetTarget },
    }),
  })

  const updateBucket = (key: BucketKey, patch: Partial<BucketState>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <RateLimitBucketCard
        title="登录限流（按 IP）"
        description="登录页 30 分钟内重试上限。无论登录成功失败都计入计数；窗口内的失败次数过多会临时锁定该 IP。"
        windowFieldId="rate-limit-signin-window"
        attemptsFieldId="rate-limit-signin-attempts"
        bucket={draft.signInIp}
        onChangeWindow={(value) => updateBucket('signInIp', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('signInIp', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。历史默认 30 分钟（1800）。"
        attemptsHint="历史默认 5 次。"
      />

      <RateLimitBucketCard
        title="评论限流（按 IP）"
        description="匿名评论 / 留言提交按访客 IP 计数。已登录管理员的提交不受限制。"
        windowFieldId="rate-limit-comment-ip-window"
        attemptsFieldId="rate-limit-comment-ip-attempts"
        bucket={draft.commentPostIp}
        onChangeWindow={(value) => updateBucket('commentPostIp', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('commentPostIp', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。历史默认 1 小时（3600）。"
        attemptsHint="历史默认 12 次。"
      />

      <RateLimitBucketCard
        title="评论限流（按邮箱）"
        description="评论作者邮箱级别的限流。即使从多个 IP 提交，同一邮箱仍然受限。Redis 中只存储邮箱的哈希值，原文不落库。"
        windowFieldId="rate-limit-comment-email-window"
        attemptsFieldId="rate-limit-comment-email-attempts"
        bucket={draft.commentPostEmail}
        onChangeWindow={(value) => updateBucket('commentPostEmail', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('commentPostEmail', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。历史默认 1 小时（3600）。"
        attemptsHint="历史默认 8 次。"
      />

      <RateLimitBucketCard
        title="点赞限流（按 IP）"
        description="文章 / 页面「喜欢」按 IP 计数，仅限制新增（点赞）操作；取消点赞不会消耗计数。窗口超出后短时间内的反复点赞会被拒绝，避免 like 表急剧膨胀。"
        windowFieldId="rate-limit-like-window"
        attemptsFieldId="rate-limit-like-attempts"
        bucket={draft.likeIncreaseIp}
        onChangeWindow={(value) => updateBucket('likeIncreaseIp', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('likeIncreaseIp', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。默认 1 小时（3600）。"
        attemptsHint="默认 30 次。一名访客在文章列表里翻页点赞通常远低于该值。"
      />

      <RateLimitBucketCard
        title="邀请限流（按 IP）"
        description="管理员邀请新作者按客户端 IP 计数，避免短时间内被滥用。"
        windowFieldId="rate-limit-invite-ip-window"
        attemptsFieldId="rate-limit-invite-ip-attempts"
        bucket={draft.inviteIp}
        onChangeWindow={(value) => updateBucket('inviteIp', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('inviteIp', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。默认 1 小时（3600）。"
        attemptsHint="默认 5 次。"
      />

      <RateLimitBucketCard
        title="密码重置限流（按 IP）"
        description='公共 lostpassword 表单按客户端 IP 计数；与防止枚举的"总是返回成功"语义无关，仅限制每 IP 触发次数。'
        windowFieldId="rate-limit-password-reset-ip-window"
        attemptsFieldId="rate-limit-password-reset-ip-attempts"
        bucket={draft.passwordResetIp}
        onChangeWindow={(value) => updateBucket('passwordResetIp', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('passwordResetIp', { maxAttempts: value })}
        windowHint="60 秒 - 24 小时。默认 30 分钟（1800）。"
        attemptsHint="默认 3 次。"
      />

      <RateLimitBucketCard
        title="密码重置限流（按目标用户）"
        description='管理员触发的"发送密码重置"操作按目标用户 ID 计数。即使发起的 admin IP 没问题，单个目标用户在窗口内也只能收到有限封邮件。'
        windowFieldId="rate-limit-password-reset-target-window"
        attemptsFieldId="rate-limit-password-reset-target-attempts"
        bucket={draft.passwordResetTarget}
        onChangeWindow={(value) => updateBucket('passwordResetTarget', { windowSeconds: value })}
        onChangeAttempts={(value) => updateBucket('passwordResetTarget', { maxAttempts: value })}
        windowHint="60 秒 - 1 小时。默认 60 秒。"
        attemptsHint="默认 1 次（建议不要放宽，单一目标 60 秒内 1 封邮件已经能覆盖正常运维节奏）。"
      />

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
