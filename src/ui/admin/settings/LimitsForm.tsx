import type { LimitsSettings } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'

const BOUNDS = {
  maxRequestBodySize: { min: 1024, max: 100 * 1024 * 1024 },
  sessionMaxAge: { min: 60, max: 365 * 24 * 60 * 60 },
} as const

interface LimitsFormProps {
  limits: LimitsSettings
}

export function LimitsForm({ limits }: LimitsFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    LimitsSettings,
    LimitsSettings
  >({
    section: 'limits',
    source: limits,
    toState: (source) => ({ ...source }),
    fromState: (state) => ({ ...state }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="请求限制"
        description="控制上传文件、表单提交等场景的最大请求体大小。过大可能增加内存压力，过小则可能导致图片上传失败。"
      >
        <SettingsRow
          label="最大请求体大小（字节）"
          htmlFor="limits-max-request-body-size"
          hint={`范围 ${BOUNDS.maxRequestBodySize.min} - ${BOUNDS.maxRequestBodySize.max}。默认 10 MB（${10 * 1024 * 1024}）。`}
        >
          <Input
            id="limits-max-request-body-size"
            type="number"
            min={BOUNDS.maxRequestBodySize.min}
            max={BOUNDS.maxRequestBodySize.max}
            value={draft.maxRequestBodySize}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                maxRequestBodySize: Number.parseInt(e.target.value, 10) || BOUNDS.maxRequestBodySize.min,
              }))
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="会话限制" description="管理后台与公共站点的登录会话有效期。过期后用户需要重新登录。">
        <SettingsRow
          label="会话最大有效期（秒）"
          htmlFor="limits-session-max-age"
          hint={`范围 ${BOUNDS.sessionMaxAge.min} - ${BOUNDS.sessionMaxAge.max}。默认 30 天（${60 * 60 * 24 * 30}）。`}
        >
          <Input
            id="limits-session-max-age"
            type="number"
            min={BOUNDS.sessionMaxAge.min}
            max={BOUNDS.sessionMaxAge.max}
            value={draft.sessionMaxAge}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                sessionMaxAge: Number.parseInt(e.target.value, 10) || BOUNDS.sessionMaxAge.min,
              }))
            }
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
