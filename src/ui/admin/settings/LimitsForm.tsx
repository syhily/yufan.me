import type { LimitsSettings } from '@/shared/config/blog'

import { GhostSettingGroup } from '@/ui/admin/settings-ghost/GhostSettingGroup'
import { GhostSettingGroupContent } from '@/ui/admin/settings-ghost/GhostSettingGroupContent'
import { GhostSettingValue } from '@/ui/admin/settings-ghost/GhostSettingValue'
import { useSettingsCard } from '@/ui/admin/settings-ghost/useSettingsCard'
import { SettingsRow } from '@/ui/admin/settings/SettingsSection'
import { Input } from '@/ui/components/input'

interface LimitsFormProps {
  limits: LimitsSettings
}

const BOUNDS = {
  maxRequestBodySize: { min: 1024, max: 100 * 1024 * 1024 },
  sessionMaxAge: { min: 60, max: 365 * 24 * 60 * 60 },
} as const

function LimitsRequestCard({ limits }: { limits: LimitsSettings }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    LimitsSettings,
    { maxRequestBodySize: number }
  >({
    section: 'limits',
    source: limits,
    toState: (source) => ({ maxRequestBodySize: source.maxRequestBodySize }),
    fromState: (state) => ({
      maxRequestBodySize: state.maxRequestBodySize,
      sessionMaxAge: limits.sessionMaxAge,
    }),
  })

  return (
    <GhostSettingGroup
      title="请求限制"
      description="控制上传文件、表单提交等场景的最大请求体大小。过大可能增加内存压力，过小则可能导致图片上传失败。"
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
            label="最大请求体大小（字节）"
            htmlFor="limits-max-request-body-size"
            hint={`范围 ${BOUNDS.maxRequestBodySize.min} - ${BOUNDS.maxRequestBodySize.max}。默认 10 MB（${10 * 1024 * 1024}）。`}
          >
            <Input
              id="limits-max-request-body-size"
              type="number"
              min={BOUNDS.maxRequestBodySize.min}
              max={BOUNDS.maxRequestBodySize.max}
              {...form.register('maxRequestBodySize', { valueAsNumber: true })}
            />
          </SettingsRow>
        </GhostSettingGroupContent>
      ) : (
        <GhostSettingGroupContent>
          <GhostSettingValue
            label="最大请求体大小"
            value={`${limits.maxRequestBodySize.toLocaleString()} 字节`}
            hint={`约 ${(limits.maxRequestBodySize / (1024 * 1024)).toFixed(1)} MB`}
          />
        </GhostSettingGroupContent>
      )}
    </GhostSettingGroup>
  )
}

function LimitsSessionCard({ limits }: { limits: LimitsSettings }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    LimitsSettings,
    { sessionMaxAge: number }
  >({
    section: 'limits',
    source: limits,
    toState: (source) => ({ sessionMaxAge: source.sessionMaxAge }),
    fromState: (state) => ({
      maxRequestBodySize: limits.maxRequestBodySize,
      sessionMaxAge: state.sessionMaxAge,
    }),
  })

  return (
    <GhostSettingGroup
      title="会话限制"
      description="管理后台与公共站点的登录会话有效期。过期后用户需要重新登录。"
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
            label="会话最大有效期（秒）"
            htmlFor="limits-session-max-age"
            hint={`范围 ${BOUNDS.sessionMaxAge.min} - ${BOUNDS.sessionMaxAge.max}。默认 30 天（${60 * 60 * 24 * 30}）。`}
          >
            <Input
              id="limits-session-max-age"
              type="number"
              min={BOUNDS.sessionMaxAge.min}
              max={BOUNDS.sessionMaxAge.max}
              {...form.register('sessionMaxAge', { valueAsNumber: true })}
            />
          </SettingsRow>
        </GhostSettingGroupContent>
      ) : (
        <GhostSettingGroupContent>
          <GhostSettingValue
            label="会话最大有效期"
            value={`${limits.sessionMaxAge.toLocaleString()} 秒`}
            hint={`约 ${Math.round(limits.sessionMaxAge / (60 * 60 * 24))} 天`}
          />
        </GhostSettingGroupContent>
      )}
    </GhostSettingGroup>
  )
}

export function LimitsForm({ limits }: LimitsFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <LimitsRequestCard limits={limits} />
      <LimitsSessionCard limits={limits} />
    </div>
  )
}
