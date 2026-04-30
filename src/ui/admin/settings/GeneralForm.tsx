import { Trash2Icon } from 'lucide-react'
import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Input } from '@/ui/admin/shadcn/components/ui/input'

interface GeneralFormProps {
  settings: BlogSettings
  csrfToken: string
}

interface FormState {
  title: string
  description: string
  website: string
  keywords: string[]
  authorName: string
  authorEmail: string
  authorUrl: string
}

function snapshotFromSettings(settings: BlogSettings): FormState {
  return {
    title: settings.title,
    description: settings.description,
    website: settings.website,
    keywords: [...settings.keywords],
    authorName: settings.author.name,
    authorEmail: settings.author.email,
    authorUrl: settings.author.url,
  }
}

function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.website === b.website &&
    a.authorName === b.authorName &&
    a.authorEmail === b.authorEmail &&
    a.authorUrl === b.authorUrl &&
    a.keywords.length === b.keywords.length &&
    a.keywords.every((value, index) => value === b.keywords[index])
  )
}

export function GeneralForm({ settings, csrfToken: _csrfToken }: GeneralFormProps) {
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<FormState>(snapshot)

  // Re-seed local state whenever the parent loader hands back a fresh
  // snapshot (e.g. after a successful save triggers revalidation).
  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !statesEqual(draft, snapshot)

  const onSaved = useCallback(() => {
    setSnapshot(draft)
  }, [draft])

  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'general',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      title: draft.title.trim(),
      description: draft.description.trim(),
      website: draft.website.trim(),
      keywords: draft.keywords.map((k) => k.trim()).filter((k) => k.length > 0),
      author: {
        name: draft.authorName.trim(),
        email: draft.authorEmail.trim(),
        url: draft.authorUrl.trim(),
      },
    })
  }

  const updateKeyword = (index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev.keywords]
      next[index] = value
      return { ...prev, keywords: next }
    })
  }
  const addKeyword = () => setDraft((prev) => ({ ...prev, keywords: [...prev.keywords, ''] }))
  const removeKeyword = (index: number) => {
    setDraft((prev) => ({ ...prev, keywords: prev.keywords.filter((_, i) => i !== index) }))
  }

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="基本信息"
        description="站点标题、描述、关键词、作者签名。SEO 和邮件模板也会读取这些字段。"
      >
        <FieldRow label="站点标题" htmlFor="general-title">
          <Input
            id="general-title"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            required
            maxLength={120}
          />
        </FieldRow>
        <FieldRow label="站点描述" htmlFor="general-description" hint="出现在首页 SEO description 与默认 meta 中。">
          <Input
            id="general-description"
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            required
            maxLength={240}
          />
        </FieldRow>
        <FieldRow label="站点 URL" htmlFor="general-website" hint="必须是完整的 https URL，结尾不带斜杠。">
          <Input
            id="general-website"
            type="url"
            value={draft.website}
            onChange={(e) => setDraft((prev) => ({ ...prev, website: e.target.value }))}
            required
            placeholder="https://example.com"
          />
        </FieldRow>
        <FieldRow label="关键词" hint="搜索引擎 keyword meta，每个不超过 60 字符，最多 20 个。">
          <div className="tw:flex tw:flex-col tw:gap-2">
            {draft.keywords.map((keyword, index) => (
              <div key={index} className="tw:flex tw:gap-2">
                <Input
                  value={keyword}
                  onChange={(e) => updateKeyword(index, e.target.value)}
                  maxLength={60}
                  placeholder="例如：blog"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeKeyword(index)}
                  aria-label="删除关键词"
                >
                  <Trash2Icon className="tw:size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addKeyword}
              disabled={draft.keywords.length >= 20}
            >
              添加关键词
            </Button>
          </div>
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="作者信息"
        description="评论邮件 + RSS feed 的 author 字段都引用这里的姓名 / 邮箱 / 主页。"
      >
        <FieldRow label="作者姓名" htmlFor="general-author-name">
          <Input
            id="general-author-name"
            value={draft.authorName}
            onChange={(e) => setDraft((prev) => ({ ...prev, authorName: e.target.value }))}
            required
            maxLength={60}
          />
        </FieldRow>
        <FieldRow label="作者邮箱" htmlFor="general-author-email" hint="评论通知 / 待审核提醒发件人。">
          <Input
            id="general-author-email"
            type="email"
            value={draft.authorEmail}
            onChange={(e) => setDraft((prev) => ({ ...prev, authorEmail: e.target.value }))}
            required
          />
        </FieldRow>
        <FieldRow label="作者主页" htmlFor="general-author-url">
          <Input
            id="general-author-url"
            type="url"
            value={draft.authorUrl}
            onChange={(e) => setDraft((prev) => ({ ...prev, authorUrl: e.target.value }))}
            required
            placeholder="https://example.com"
          />
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
