import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'

import type { SiteIdentitySettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/ui/button'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/ui/components/ui/combobox'
import { Input } from '@/ui/components/ui/input'

interface TimeZoneItem {
  value: string
  label: string
}

interface GeneralFormProps {
  // Per-section DTO: see `SiteIdentitySettings` in `@/shared/blog-config`.
  // The matching DB row is `setting('blog.general')`.
  siteIdentity: SiteIdentitySettings
  /**
   * Canonical IANA timezone list, supplied by the layout loader from
   * `getSupportedTimeZones()`. Keeps this UI module in the
   * client-safe `@/ui/*` layer (no server import).
   */
  timeZones: readonly string[]
}

// Client-side schema mirrors the server's `generalSchema` in
// `@/server/settings/schema.ts`. We duplicate it here instead of
// importing the server module so the client bundle does not pull in
// `@/server/**`. The two copies move together — the server is still
// the authoritative validator (the `updateSettings` action will reject
// a payload that fails the server-side parse), the client copy is
// only responsible for surfacing field-level errors inline before the
// user hits "save".
const generalFormSchema = z.object({
  title: z.string().trim().min(1, '请填写站点标题').max(120, '最多 120 个字符'),
  description: z.string().trim().min(1, '请填写站点描述').max(240, '最多 240 个字符'),
  website: z.url({ message: '请填写完整的 URL（包含 https://）' }),
  keywords: z
    .array(
      z.object({
        value: z.string().trim().min(1, '关键词不能为空').max(60, '最多 60 个字符'),
      }),
    )
    .max(20, '最多 20 个关键词'),
  author: z.object({
    name: z.string().trim().min(1, '请填写作者姓名').max(60, '最多 60 个字符'),
    email: z.email({ message: '请填写合法的邮箱地址' }),
    url: z.url({ message: '请填写完整的 URL（包含 https://）' }),
  }),
  locale: z.string().trim().min(2, 'BCP 47 标签至少 2 个字符').max(35, '最多 35 个字符'),
  timeZone: z.string().trim().min(1, '请选择时区').max(64, '最多 64 个字符'),
  timeFormat: z.string().trim().min(1, '请填写日期格式').max(40, '最多 40 个字符'),
})
type GeneralFormValues = z.infer<typeof generalFormSchema>

function toFormValues(source: SiteIdentitySettings): GeneralFormValues {
  return {
    title: source.title,
    description: source.description,
    website: source.website,
    keywords: source.keywords.map((value) => ({ value })),
    author: {
      name: source.author.name,
      email: source.author.email,
      url: source.author.url,
    },
    locale: source.locale,
    timeZone: source.timeZone,
    timeFormat: source.timeFormat,
  }
}

export function GeneralForm({ siteIdentity, timeZones }: GeneralFormProps) {
  const { onSubmit, isDirty, isPending, status, errorMessage, revert, form } = useSettingsForm<
    SiteIdentitySettings,
    GeneralFormValues
  >({
    section: 'general',
    source: siteIdentity,
    schema: generalFormSchema,
    toState: toFormValues,
    fromState: (values) => ({
      title: values.title.trim(),
      description: values.description.trim(),
      website: values.website.trim(),
      keywords: values.keywords.map((k) => k.value.trim()).filter((v) => v.length > 0),
      author: {
        name: values.author.name.trim(),
        email: values.author.email.trim(),
        url: values.author.url.trim(),
      },
      locale: values.locale.trim(),
      timeZone: values.timeZone.trim(),
      timeFormat: values.timeFormat.trim(),
    }),
  })
  const { register, control, formState } = form
  const keywords = useFieldArray({ control, name: 'keywords' })

  // Adapt the canonical IANA list to Base UI Combobox's `{ value, label }`
  // contract. The transformation is cheap (~400 entries) but memoised so
  // the Combobox does not see a fresh array reference on every keystroke
  // and re-derive its filter state.
  const timeZoneItems = useMemo<TimeZoneItem[]>(
    () => timeZones.map((zone) => ({ value: zone, label: zone })),
    [timeZones],
  )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="基本信息"
        description="站点标题、描述、关键词、作者签名。SEO 和邮件模板也会读取这些字段。"
      >
        <SettingsRow label="站点标题" htmlFor="general-title" error={formState.errors.title?.message}>
          {(controlProps) => <Input id="general-title" maxLength={120} {...register('title')} {...controlProps} />}
        </SettingsRow>
        <SettingsRow
          label="站点描述"
          htmlFor="general-description"
          hint="出现在首页 SEO description 与默认 meta 中。"
          error={formState.errors.description?.message}
        >
          {(controlProps) => (
            <Input id="general-description" maxLength={240} {...register('description')} {...controlProps} />
          )}
        </SettingsRow>
        <SettingsRow
          label="站点 URL"
          htmlFor="general-website"
          hint="必须是完整的 https URL，结尾不带斜杠。"
          error={formState.errors.website?.message}
        >
          {(controlProps) => (
            <Input
              id="general-website"
              type="url"
              placeholder="https://example.com"
              {...register('website')}
              {...controlProps}
            />
          )}
        </SettingsRow>
        <SettingsRow
          label="关键词"
          hint="搜索引擎 keyword meta，每个不超过 60 字符，最多 20 个。"
          error={formState.errors.keywords?.message || formState.errors.keywords?.root?.message}
        >
          <div className="flex flex-col gap-2">
            {keywords.fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  maxLength={60}
                  placeholder="例如：blog"
                  aria-invalid={formState.errors.keywords?.[index]?.value ? true : undefined}
                  {...register(`keywords.${index}.value` as const)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => keywords.remove(index)}
                  aria-label="删除关键词"
                >
                  <Trash2Icon data-icon />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => keywords.append({ value: '' })}
              disabled={keywords.fields.length >= 20}
            >
              <PlusIcon data-icon /> 添加关键词
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="作者信息"
        description="评论邮件 + RSS feed 的 author 字段都引用这里的姓名 / 邮箱 / 主页。"
      >
        <SettingsRow label="作者姓名" htmlFor="general-author-name" error={formState.errors.author?.name?.message}>
          {(controlProps) => (
            <Input id="general-author-name" maxLength={60} {...register('author.name')} {...controlProps} />
          )}
        </SettingsRow>
        <SettingsRow
          label="作者邮箱"
          htmlFor="general-author-email"
          hint="评论通知 / 待审核提醒发件人。"
          error={formState.errors.author?.email?.message}
        >
          {(controlProps) => (
            <Input id="general-author-email" type="email" {...register('author.email')} {...controlProps} />
          )}
        </SettingsRow>
        <SettingsRow label="作者主页" htmlFor="general-author-url" error={formState.errors.author?.url?.message}>
          {(controlProps) => (
            <Input
              id="general-author-url"
              type="url"
              placeholder="https://example.com"
              {...register('author.url')}
              {...controlProps}
            />
          )}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="时间与本地化"
        description="影响日期格式化函数（formatLocalDate / formatShowDate）以及 OG 图、邮件模板等所有依赖时区的渲染分支。"
      >
        <SettingsRow
          label="语言"
          htmlFor="general-locale"
          hint="BCP 47 语言标签，例如 zh-CN、en-US。"
          error={formState.errors.locale?.message}
        >
          {(controlProps) => (
            <Input id="general-locale" maxLength={35} placeholder="zh-CN" {...register('locale')} {...controlProps} />
          )}
        </SettingsRow>
        <SettingsRow
          label="时区"
          htmlFor="general-timezone"
          hint="IANA / tzdata 时区，输入关键字过滤。列表由当前 Node 运行时的 ICU 数据提供。"
          error={formState.errors.timeZone?.message}
        >
          {/*
           * Searchable combobox — same primitive the comments admin
           * page uses for its "筛选文章 / 筛选评论人员" filters, so the
           * picker behaviour stays consistent across the admin
           * surface. Base UI handles substring filtering against
           * `items` client-side; no fetcher needed because the full
           * tzdata list is small and already on the wire.
           */}
          <Controller
            control={control}
            name="timeZone"
            render={({ field }) => {
              const selected = timeZoneItems.find((item) => item.value === field.value) ?? null
              return (
                <Combobox<TimeZoneItem>
                  items={timeZoneItems}
                  value={selected}
                  onValueChange={(item) => {
                    if (item) {
                      field.onChange(item.value)
                    }
                  }}
                >
                  <ComboboxTrigger id="general-timezone" className="w-full">
                    <ComboboxValue placeholder="搜索 IANA 时区…" />
                  </ComboboxTrigger>
                  <ComboboxContent<TimeZoneItem> inputPlaceholder="搜索 IANA 时区…" emptyMessage="无匹配时区">
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              )
            }}
          />
        </SettingsRow>
        <SettingsRow
          label="日期格式"
          htmlFor="general-time-format"
          hint="支持 yyyy / LL / MM / dd / HH / mm 占位符，例如 yyyy-LL-dd HH:mm。"
          error={formState.errors.timeFormat?.message}
        >
          {(controlProps) => (
            <Input
              id="general-time-format"
              maxLength={40}
              placeholder="yyyy-LL-dd HH:mm"
              {...register('timeFormat')}
              {...controlProps}
            />
          )}
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
