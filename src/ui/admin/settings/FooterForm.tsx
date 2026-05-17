import type { FooterSettings } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

interface FooterFormProps {
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
        icpNo: state.icpNo,
        moeIcpNo: state.moeIcpNo,
      },
    }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="页脚信息" description="网站页脚的版权年份与备案号。">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-initial-year">起始年份</Label>
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
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-icp">ICP 备案号</Label>
            <Input
              id="footer-icp"
              value={draft.icpNo ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, icpNo: e.target.value }))}
              placeholder="例如：皖ICP备2021002315号-2"
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="footer-moe-icp">萌国备案号</Label>
            <Input
              id="footer-moe-icp"
              value={draft.moeIcpNo ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, moeIcpNo: e.target.value }))}
              maxLength={60}
            />
          </div>
        </div>
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
