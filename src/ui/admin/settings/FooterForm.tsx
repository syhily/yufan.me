import type { FooterSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'

interface FooterFormProps {
  // Per-section DTO,
  // so this form re-renders only when the footer row actually changes.
  footer: FooterSettings['footer']
}

interface FormState {
  initialYear: number
  icpNo: string
  moeIcpNo: string
}

export function FooterForm({ footer }: FooterFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    FooterSettings['footer'],
    FormState
  >({
    section: 'footer',
    source: footer,
    toState: (source) => ({
      initialYear: source.initialYear,
      icpNo: source.icpNo ?? '',
      moeIcpNo: source.moeIcpNo ?? '',
    }),
    fromState: (state) => ({
      footer: {
        initialYear: state.initialYear,
        ...(state.icpNo.trim() ? { icpNo: state.icpNo.trim() } : {}),
        ...(state.moeIcpNo.trim() ? { moeIcpNo: state.moeIcpNo.trim() } : {}),
      },
    }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="页脚信息" description="网站页脚的版权年份与备案号。">
        <SettingsRow label="起始年份" htmlFor="footer-initial-year" hint="©{起始年份} - {当前年份}。">
          <Input
            id="footer-initial-year"
            type="number"
            min={1970}
            max={9999}
            value={draft.initialYear}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                initialYear: Number.parseInt(e.target.value, 10) || 1970,
              }))
            }
          />
        </SettingsRow>
        <SettingsRow label="ICP 备案号" htmlFor="footer-icp" hint="留空表示不显示。">
          <Input
            id="footer-icp"
            value={draft.icpNo}
            onChange={(e) => setDraft((prev) => ({ ...prev, icpNo: e.target.value }))}
            placeholder="例如：皖ICP备2021002315号-2"
            maxLength={60}
          />
        </SettingsRow>
        <SettingsRow label="萌国备案号" htmlFor="footer-moe-icp" hint="留空表示不显示。">
          <Input
            id="footer-moe-icp"
            value={draft.moeIcpNo}
            onChange={(e) => setDraft((prev) => ({ ...prev, moeIcpNo: e.target.value }))}
            maxLength={60}
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
