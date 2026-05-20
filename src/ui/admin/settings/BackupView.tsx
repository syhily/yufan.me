import { useCallback, useRef, useState } from 'react'

import type { BackupSettings } from '@/shared/config/blog'

import { orpc } from '@/client/api/client'
import { useMutation, useQuery, useQueryClient } from '@/client/api/query'
import { SettingsRow } from '@/ui/admin/settings/SettingsSection'
import { SettingGroup } from '@/ui/admin/settings/shell/SettingGroup'
import { SettingGroupContent } from '@/ui/admin/settings/shell/SettingGroupContent'
import { SettingValue } from '@/ui/admin/settings/shell/SettingValue'
import { useSettingsCard } from '@/ui/admin/settings/shell/useSettingsCard'
import { Button } from '@/ui/components/button'
import { FieldLabel } from '@/ui/components/field'
import { Input } from '@/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Switch } from '@/ui/components/switch'

interface BackupViewProps {
  backup: BackupSettings | null
  timeZone: string
}

interface FormState {
  scheduledEnabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  dayOfWeek?: number
  dayOfMonth?: number
  retentionEnabled: boolean
  retentionDays: number
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 30]

const FREQ_LABELS: Record<string, string> = { daily: '每天', weekly: '每周', monthly: '每月' }

const FALLBACK_BACKUP: BackupSettings = {
  scheduled: { enabled: false, frequency: 'daily', hour: 3, minute: 0 },
  retention: { enabled: true, days: 30 },
}

function ScheduledBackupCard({ backup, canConfigure }: { backup: BackupSettings; canConfigure: boolean }) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    BackupSettings,
    FormState
  >({
    section: 'backup',
    source: backup,
    toState: (source) => ({
      scheduledEnabled: source.scheduled.enabled,
      frequency: source.scheduled.frequency,
      hour: source.scheduled.hour,
      minute: source.scheduled.minute,
      dayOfWeek: source.scheduled.dayOfWeek,
      dayOfMonth: source.scheduled.dayOfMonth,
      retentionEnabled: source.retention.enabled,
      retentionDays: source.retention.days,
    }),
    fromState: (state) => ({
      scheduled: {
        enabled: state.scheduledEnabled,
        frequency: state.frequency,
        hour: state.hour,
        minute: state.minute,
        dayOfWeek: state.frequency === 'weekly' ? state.dayOfWeek : undefined,
        dayOfMonth: state.frequency === 'monthly' ? state.dayOfMonth : undefined,
      },
      retention: {
        enabled: state.retentionEnabled,
        days: state.retentionDays,
      },
    }),
  })

  const enabled = form.watch('scheduledEnabled')
  const frequency = form.watch('frequency')
  const retentionEnabled = form.watch('retentionEnabled')

  return (
    <SettingGroup
      title="定时备份"
      description="配置自动备份的频率与保留策略。"
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      onSave={save}
      onCancel={cancel}
      saveState={status}
      errorMessage={errorMessage}
    >
      {isEditing ? (
        <SettingGroupContent>
          <SettingsRow label="启用定时备份">
            <div className="flex items-center gap-3">
              <Switch
                id="scheduled-enabled"
                checked={enabled}
                disabled={!canConfigure}
                onCheckedChange={(value) => form.setValue('scheduledEnabled', value === true)}
              />
              <FieldLabel htmlFor="scheduled-enabled" className="font-normal">
                开启
              </FieldLabel>
            </div>
          </SettingsRow>

          {enabled && (
            <>
              <SettingsRow label="备份频率">
                <Select
                  value={frequency}
                  onValueChange={(v) => form.setValue('frequency', v as 'daily' | 'weekly' | 'monthly')}
                  disabled={!canConfigure}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow label="备份时间">
                <div className="flex gap-2">
                  <Select
                    value={String(form.watch('hour'))}
                    onValueChange={(v) => form.setValue('hour', Number(v))}
                    disabled={!canConfigure}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center text-muted-foreground">:</span>
                  <Select
                    value={String(form.watch('minute'))}
                    onValueChange={(v) => form.setValue('minute', Number(v))}
                    disabled={!canConfigure}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {String(m).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SettingsRow>

              {frequency === 'weekly' && (
                <SettingsRow label="星期">
                  <Select
                    value={form.watch('dayOfWeek') ? String(form.watch('dayOfWeek')) : ''}
                    onValueChange={(v) => form.setValue('dayOfWeek', Number(v))}
                    disabled={!canConfigure}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <SelectItem key={label} value={String(idx + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsRow>
              )}

              {frequency === 'monthly' && (
                <SettingsRow label="每月日期">
                  <Select
                    value={form.watch('dayOfMonth') ? String(form.watch('dayOfMonth')) : ''}
                    onValueChange={(v) => form.setValue('dayOfMonth', Number(v))}
                    disabled={!canConfigure}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} 日
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsRow>
              )}

              <SettingsRow label="保留策略">
                <div className="flex items-center gap-3">
                  <Switch
                    id="retention-enabled"
                    checked={retentionEnabled}
                    disabled={!canConfigure}
                    onCheckedChange={(value) => form.setValue('retentionEnabled', value === true)}
                  />
                  <FieldLabel htmlFor="retention-enabled" className="font-normal">
                    自动清理历史备份
                  </FieldLabel>
                </div>
              </SettingsRow>

              {retentionEnabled && (
                <SettingsRow label="保留天数" hint="超过此天数的旧备份将被自动删除。">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    disabled={!canConfigure}
                    {...form.register('retentionDays', { valueAsNumber: true })}
                  />
                </SettingsRow>
              )}
            </>
          )}
        </SettingGroupContent>
      ) : (
        <SettingGroupContent>
          <SettingValue label="定时备份" value={backup.scheduled.enabled ? '已开启' : '已关闭'} />
          {backup.scheduled.enabled && (
            <>
              <SettingValue label="备份频率" value={FREQ_LABELS[backup.scheduled.frequency]} />
              <SettingValue
                label="备份时间"
                value={`${String(backup.scheduled.hour).padStart(2, '0')}:${String(backup.scheduled.minute).padStart(2, '0')}`}
              />
              {backup.scheduled.frequency === 'weekly' && backup.scheduled.dayOfWeek && (
                <SettingValue label="星期" value={WEEKDAY_LABELS[backup.scheduled.dayOfWeek - 1]} />
              )}
              {backup.scheduled.frequency === 'monthly' && backup.scheduled.dayOfMonth && (
                <SettingValue label="每月日期" value={`${backup.scheduled.dayOfMonth} 日`} />
              )}
              <SettingValue
                label="保留策略"
                value={backup.retention.enabled ? `保留 ${backup.retention.days} 天` : '不自动清理'}
              />
            </>
          )}
        </SettingGroupContent>
      )}
    </SettingGroup>
  )
}

export function BackupView({ backup }: BackupViewProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreKey, setRestoreKey] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: statusData, isPending: statusLoading } = useQuery({
    queryKey: ['admin', 'backup', 'status'],
    queryFn: () => orpc.admin.backup.status(),
  })

  const { data: listData, isPending: listLoading } = useQuery({
    queryKey: ['admin', 'backup', 'list'],
    queryFn: () => orpc.admin.backup.list(),
  })

  const s3Enabled = statusData?.s3Enabled ?? false
  const pgToolsAvailable = statusData?.pgToolsAvailable ?? false
  const backups = listData?.files ?? []

  const source = backup ?? FALLBACK_BACKUP

  const createMutation = useMutation({
    mutationFn: () => orpc.admin.backup.create(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'backup', 'list'] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => orpc.admin.backup.restore({ key }),
    onSuccess: () => {
      setRestoreKey(null)
      alert('还原成功，服务即将重启…')
    },
  })

  const handleUploadRestore = useCallback(async () => {
    const input = fileInputRef.current
    if (!input?.files?.[0]) {
      return
    }
    const file = input.files[0]
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/backup/upload-restore', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } }
        throw new Error(data.error?.message ?? '上传还原失败')
      }
      alert('还原成功，服务即将重启…')
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传还原失败')
    } finally {
      setUploading(false)
      input.value = ''
    }
  }, [])

  const canConfigure = s3Enabled && pgToolsAvailable
  const isLoading = statusLoading || listLoading

  return (
    <div className="flex flex-col gap-6">
      {isLoading && <div className="text-sm text-muted-foreground">正在读取备份信息…</div>}
      {!isLoading && !pgToolsAvailable && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700">
          当前运行环境缺少 postgresql-client，备份与还原功能不可用。
        </div>
      )}
      {!isLoading && !s3Enabled && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700">
          请先前往存储配置启用 S3 存储。
        </div>
      )}

      <ScheduledBackupCard backup={source} canConfigure={canConfigure} />

      <SettingGroup
        title="备份文件"
        description="S3 存储中 backup/ 目录下的所有备份文件。"
        actions={
          <Button
            type="button"
            disabled={createMutation.isPending || !canConfigure}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? '备份中…' : '手动备份'}
          </Button>
        }
      >
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无备份文件</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">文件名</th>
                  <th className="px-4 py-2 text-right font-medium">大小</th>
                  <th className="px-4 py-2 text-left font-medium">时间</th>
                  <th className="px-4 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backups.map((file) => (
                  <tr key={file.key}>
                    <td className="px-4 py-2 font-mono text-xs">{file.fileName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBytes(file.size)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {file.lastModified.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(`/api/admin/backup/download/${encodeURIComponent(file.key)}`)}
                        >
                          下载
                        </Button>
                        <Button
                          type="button"
                          variant="destructive-soft"
                          size="sm"
                          disabled={restoreMutation.isPending || !pgToolsAvailable}
                          onClick={() => setRestoreKey(file.key)}
                        >
                          还原
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingGroup>

      {restoreKey && (
        <ConfirmDialog
          title="确认还原"
          description={`确定要从「${restoreKey.split('/').pop()}」还原数据库吗？当前数据库将被替换，服务将在还原后重启。`}
          onConfirm={() => restoreMutation.mutate({ key: restoreKey })}
          onCancel={() => setRestoreKey(null)}
          isPending={restoreMutation.isPending}
        />
      )}

      <SettingGroup title="手动还原" description="上传 .sql.gz 备份文件进行还原。">
        <div className="flex flex-col gap-3">
          <Input ref={fileInputRef} type="file" accept=".sql.gz" disabled={!pgToolsAvailable || uploading} />
          <div className="flex gap-2">
            <Button type="button" disabled={!pgToolsAvailable || uploading} onClick={() => void handleUploadRestore()}>
              {uploading ? '上传还原中…' : '上传并还原'}
            </Button>
          </div>
        </div>
      </SettingGroup>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

interface ConfirmDialogProps {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function ConfirmDialog({ title, description, onConfirm, onCancel, isPending }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? '还原中…' : '确认还原'}
          </Button>
        </div>
      </div>
    </div>
  )
}
