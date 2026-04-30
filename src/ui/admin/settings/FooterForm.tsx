import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Input } from '@/ui/admin/shadcn/components/ui/input'

interface FooterFormProps {
  settings: BlogSettings
  csrfToken: string
}

interface FormState {
  initialYear: number
  icpNo: string
  moeIcpNo: string
}

function snapshotFromSettings(settings: BlogSettings): FormState {
  return {
    initialYear: settings.settings.footer.initialYear,
    icpNo: settings.settings.footer.icpNo ?? '',
    moeIcpNo: settings.settings.footer.moeIcpNo ?? '',
  }
}
function statesEqual(a: FormState, b: FormState): boolean {
  return a.initialYear === b.initialYear && a.icpNo === b.icpNo && a.moeIcpNo === b.moeIcpNo
}

export function FooterForm({ settings, csrfToken: _csrfToken }: FooterFormProps) {
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
    section: 'footer',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      footer: {
        initialYear: draft.initialYear,
        ...(draft.icpNo.trim() ? { icpNo: draft.icpNo.trim() } : {}),
        ...(draft.moeIcpNo.trim() ? { moeIcpNo: draft.moeIcpNo.trim() } : {}),
      },
    })
  }

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection title="页脚信息" description="网站页脚的版权年份与备案号。">
        <FieldRow label="起始年份" htmlFor="footer-initial-year" hint="©{起始年份} - {当前年份}。">
          <Input
            id="footer-initial-year"
            type="number"
            min={1970}
            max={9999}
            value={draft.initialYear}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, initialYear: Number.parseInt(e.target.value, 10) || 1970 }))
            }
          />
        </FieldRow>
        <FieldRow label="ICP 备案号" htmlFor="footer-icp" hint="留空表示不显示。">
          <Input
            id="footer-icp"
            value={draft.icpNo}
            onChange={(e) => setDraft((prev) => ({ ...prev, icpNo: e.target.value }))}
            placeholder="例如：皖ICP备2021002315号-2"
            maxLength={60}
          />
        </FieldRow>
        <FieldRow label="教育部公网备案号" htmlFor="footer-moe-icp" hint="可选，留空表示不显示。">
          <Input
            id="footer-moe-icp"
            value={draft.moeIcpNo}
            onChange={(e) => setDraft((prev) => ({ ...prev, moeIcpNo: e.target.value }))}
            maxLength={60}
          />
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
