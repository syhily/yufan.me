import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'
import { useFetcher } from 'react-router'

import type { SendTestMailOutput } from '@/client/api/action-types'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { API_ACTIONS } from '@/client/api/actions'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { useBlogConfig } from '@/ui/lib/blog-config-context'

// `MailLoaderData['mail']` mirrors the projection in the route loader.
// Repeated here as a plain type so the component can stay framework-
// pure (no React Router type imports leaking into UI).
export interface MailLoaderShape {
  enabled: boolean
  host: string
  sender: string
  /** Last 4 chars of the stored API key, or `null` when unset. */
  apiKeyMask: string | null
}

interface MailFormProps {
  mail: MailLoaderShape
  csrfToken: string
}

interface FormState {
  enabled: boolean
  host: string
  sender: string
  /**
   * Newly-typed API key. Empty string means "leave the stored key
   * alone" — the perimeter looks for `apiKey === undefined` to apply
   * the keep-existing pivot, so we strip empty values from the wire
   * payload on submit.
   */
  apiKey: string
}

const TEST = API_ACTIONS.admin.sendTestMail

function snapshotFromMail(mail: MailLoaderShape): FormState {
  return {
    enabled: mail.enabled,
    host: mail.host,
    sender: mail.sender,
    apiKey: '',
  }
}

function statesEqual(a: FormState, b: FormState): boolean {
  return a.enabled === b.enabled && a.host === b.host && a.sender === b.sender && a.apiKey === b.apiKey
}

interface TestStatus {
  state: 'idle' | 'pending' | 'success' | 'error'
  message: string | null
}

const idleTestStatus: TestStatus = { state: 'idle', message: null }

export function MailForm({ mail, csrfToken: _csrfToken }: MailFormProps) {
  const blogConfig = useBlogConfig()
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromMail(mail))
  const [draft, setDraft] = useState<FormState>(snapshot)
  // Editor's chosen recipient for the test send. Defaults to the
  // configured author email so a single click verifies the typical
  // delivery path.
  const [testTo, setTestTo] = useState<string>(blogConfig.author.email)
  const [testStatus, setTestStatus] = useState<TestStatus>(idleTestStatus)

  useEffect(() => {
    const fresh = snapshotFromMail(mail)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [mail])

  const isDirty = !statesEqual(draft, snapshot)
  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, reset, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'mail',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    // Empty `apiKey` field means "don't touch the stored secret" — the
    // perimeter applies the keep-existing pivot when the field is
    // absent / undefined on the wire.
    const trimmedKey = draft.apiKey.trim()
    save({
      mail: {
        enabled: draft.enabled,
        host: draft.host.trim(),
        sender: draft.sender.trim(),
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
      },
    })
  }

  // Test-send fetcher lives outside `useSettingsFetcher` because the
  // POST `sendTestMail` action is a side-effect, not a settings write
  // (it doesn't trigger a snapshot revalidation).
  const testFetcher = useFetcher<ApiEnvelope<SendTestMailOutput>>()
  const submitTest = useCallback(() => {
    setTestStatus({ state: 'pending', message: null })
    void testFetcher.submit({ to: testTo.trim() } as never, {
      method: TEST.method,
      encType: 'application/json',
      action: TEST.path,
    })
  }, [testFetcher, testTo])

  useEffect(() => {
    if (testFetcher.state !== 'idle' || !testFetcher.data) return
    if (testFetcher.data.error) {
      setTestStatus({ state: 'error', message: testFetcher.data.error.message ?? '测试发送失败' })
      return
    }
    if (testFetcher.data.data) {
      setTestStatus({ state: 'success', message: '测试邮件已通过 Zeabur ZSend 发送，请到收件箱确认。' })
    }
  }, [testFetcher.state, testFetcher.data])

  const isTestPending = testFetcher.state !== 'idle'
  const apiKeyConfigured = mail.apiKeyMask !== null
  // Test send only requires host + sender + an apiKey to actually exist
  // on the server — the local draft might still have an unsaved API key
  // change pending. We let the editor save first; the button stays
  // disabled when the form is dirty so they don't ship a key, then
  // immediately fire a test against the OLD key.
  const canSendTest =
    !isDirty &&
    !isTestPending &&
    !isPending &&
    snapshot.host.trim() !== '' &&
    snapshot.sender.trim() !== '' &&
    apiKeyConfigured &&
    isLikelyEmail(testTo)

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="邮件发送总开关"
        description="关闭后，所有评论通知 / 回复通知 / 审核通过通知都不会再发送（不会报错，仅记录 debug 日志）。「测试发送」按钮不受此开关影响，方便在正式启用前验证连接。"
      >
        <FieldRow label="启用邮件发送" hint="生产环境推荐先用「测试发送」确认连接，再打开此开关。">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Checkbox
              id="mail-enabled"
              checked={draft.enabled}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value === true }))}
            />
            <label htmlFor="mail-enabled" className="tw:text-sm tw:select-none">
              发送通知邮件
            </label>
          </div>
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="Zeabur ZSend 配置"
        description="配置 Zeabur ZSend 的接入地址、API Key 和发件人邮箱。修改后立即生效。"
      >
        <FieldRow label="接入域名" htmlFor="mail-host" hint="不带协议，例如 api.zeabur.com。">
          <Input
            id="mail-host"
            value={draft.host}
            onChange={(e) => setDraft((prev) => ({ ...prev, host: e.target.value }))}
            placeholder="api.zeabur.com"
            maxLength={253}
            required
          />
        </FieldRow>
        <FieldRow
          label="API Key"
          htmlFor="mail-api-key"
          hint={
            apiKeyConfigured
              ? `当前已配置（结尾 …${mail.apiKeyMask}）。留空保存表示保留现有 Key，填入新值才会覆盖。`
              : '尚未配置。在 Zeabur 控制台 ZSend 服务页面生成的密钥，将以明文存入数据库。'
          }
        >
          <Input
            id="mail-api-key"
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={apiKeyConfigured ? '保留现有 Key' : '粘贴 Zeabur ZSend API Key'}
            maxLength={512}
            autoComplete="new-password"
          />
        </FieldRow>
        <FieldRow label="发件人邮箱" htmlFor="mail-sender" hint="必须是 Zeabur 已验证过的发件域。">
          <Input
            id="mail-sender"
            type="email"
            value={draft.sender}
            onChange={(e) => setDraft((prev) => ({ ...prev, sender: e.target.value }))}
            placeholder="noreply@send.example.com"
            maxLength={253}
            required
          />
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="测试发送"
        description="不依赖「启用邮件发送」开关，可在配置完成后立即验证连接。如果有未保存的更改，请先点击下方「保存更改」。"
      >
        <FieldRow label="收件人" htmlFor="mail-test-to" hint="默认填站点作者邮箱，可以改成任意能收信的地址来验证。">
          <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row">
            <Input
              id="mail-test-to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="someone@example.com"
              className="tw:flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!canSendTest}
              onClick={submitTest}
              title={
                isDirty
                  ? '请先保存上方的更改再发送测试'
                  : !apiKeyConfigured
                    ? '请先填入并保存 API Key'
                    : !isLikelyEmail(testTo)
                      ? '请填写一个合法的邮箱地址'
                      : undefined
              }
            >
              {isTestPending ? '发送中…' : '测试发送'}
            </Button>
          </div>
        </FieldRow>
        {testStatus.state === 'success' && testStatus.message ? (
          <p className="tw:text-muted-foreground tw:text-sm">{testStatus.message}</p>
        ) : null}
        {testStatus.state === 'error' && testStatus.message ? (
          <p className="tw:text-destructive tw:text-sm tw:break-all">{testStatus.message}</p>
        ) : null}
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onReset={reset}
        resetTitle="重置邮件配置为默认？"
        resetDescription="数据库中保存的邮件配置会被清除，下次读取将回退到默认值（未启用 + 默认接入域名 + 空 API Key）。该操作不可撤销。"
      />
    </form>
  )
}

// Cheap regex check just to gate the "测试发送" button. The server
// re-validates with `z.email()` so this only governs UX affordance.
function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
