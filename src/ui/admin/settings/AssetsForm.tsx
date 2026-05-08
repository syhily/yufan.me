import type { AssetsLoaderShape } from '@/shared/config/settings'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Checkbox } from '@/ui/components/checkbox'
import { Input } from '@/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'

export type { AssetsLoaderShape }

interface AssetsFormProps {
  assets: AssetsLoaderShape
}

interface FormState {
  assetHost: string
  assetScheme: 'http' | 'https'
  enabled: boolean
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  /**
   * Newly-typed secret. Empty string means "leave the stored secret
   * alone" — the perimeter looks for `secretAccessKey === undefined`
   * to apply the keep-existing pivot, so we strip empty values from
   * the wire payload on submit.
   */
  secretAccessKey: string
  forcePathStyle: boolean
  urlTemplate: string
  maxBytes: number
  jpegQuality: number
}

const SCHEME_OPTIONS: { value: FormState['assetScheme']; label: string }[] = [
  { value: 'https', label: 'https' },
  { value: 'http', label: 'http' },
]

export function AssetsForm({ assets }: AssetsFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    AssetsLoaderShape,
    FormState
  >({
    section: 'assets',
    source: assets,
    toState: (source) => ({
      assetHost: source.asset.host,
      assetScheme: source.asset.scheme,
      enabled: source.storage.enabled,
      endpoint: source.storage.endpoint,
      region: source.storage.region,
      bucket: source.storage.bucket,
      accessKeyId: source.storage.accessKeyId,
      secretAccessKey: '',
      forcePathStyle: source.storage.forcePathStyle,
      urlTemplate: source.storage.urlTemplate,
      maxBytes: source.upload.maxBytes,
      jpegQuality: source.upload.jpegQuality,
    }),
    fromState: (state) => {
      const trimmedSecret = state.secretAccessKey.trim()
      return {
        asset: {
          host: state.assetHost.trim(),
          scheme: state.assetScheme,
        },
        storage: {
          enabled: state.enabled,
          endpoint: state.endpoint.trim(),
          region: state.region.trim(),
          bucket: state.bucket.trim(),
          accessKeyId: state.accessKeyId.trim(),
          forcePathStyle: state.forcePathStyle,
          urlTemplate: state.urlTemplate.trim(),
          ...(trimmedSecret ? { secretAccessKey: trimmedSecret } : {}),
        },
        upload: { maxBytes: state.maxBytes, jpegQuality: state.jpegQuality },
      }
    },
  })

  const secretConfigured = assets.secretAccessKeyMask !== null
  const enabled = draft.enabled

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="资源域名"
        description="统一的资源域名：MDX `<MusicPlayer>` 读取音频/歌词，图片公共 URL 也复用这里的 host + scheme。"
      >
        <SettingsRow label="协议" htmlFor="assets-asset-scheme">
          <Select
            items={SCHEME_OPTIONS}
            value={draft.assetScheme}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                assetScheme: (value ?? 'https') as FormState['assetScheme'],
              }))
            }
          >
            <SelectTrigger id="assets-asset-scheme" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="域名"
          htmlFor="assets-asset-host"
          hint="只能包含字母 / 数字 / `-` / `.`，例如 `cat.example.com`。"
        >
          <Input
            id="assets-asset-host"
            value={draft.assetHost}
            onChange={(e) => setDraft((prev) => ({ ...prev, assetHost: e.target.value }))}
            required
            maxLength={253}
            placeholder="cat.example.com"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="启用图片上传"
        description="未开启时「图片管理」页面只能浏览历史图片，所有上传 / 替换入口都会返回 503。开启后需提供下方的 S3 兼容存储配置。"
      >
        <SettingsRow label="启用 S3 上传" hint="关闭后已经入库的图片仍按上方的资源域名解析，确保历史文章不会出现裂图。">
          <div className="flex items-center gap-2">
            <Checkbox
              id="assets-storage-enabled"
              checked={enabled}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value === true }))}
            />
            <label htmlFor="assets-storage-enabled" className="cursor-pointer text-sm">
              {enabled ? '已开启 — 上传到下方配置的 S3 兼容存储' : '已关闭 — 后台禁用上传，仅可浏览已上传的图片'}
            </label>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="S3 兼容存储"
        description={
          enabled
            ? '所有上传到「图片管理」的图片都会写入这里。修改后立即生效（保存后下一次上传就会使用新配置）。'
            : '当前未启用上传。可以提前填好凭据，开启上述开关后即可生效。'
        }
      >
        <SettingsRow
          label="Endpoint"
          htmlFor="assets-endpoint"
          hint="完整 URL，例如 https://s3.amazonaws.com 或 https://<account>.r2.cloudflarestorage.com。"
        >
          <Input
            id="assets-endpoint"
            type="url"
            value={draft.endpoint}
            onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="https://s3.amazonaws.com"
            required={enabled}
          />
        </SettingsRow>
        <SettingsRow label="Region" htmlFor="assets-region" hint="例：us-east-1 / auto（R2 / B2）。">
          <Input
            id="assets-region"
            value={draft.region}
            onChange={(e) => setDraft((prev) => ({ ...prev, region: e.target.value }))}
            maxLength={60}
            required={enabled}
          />
        </SettingsRow>
        <SettingsRow label="Bucket" htmlFor="assets-bucket">
          <Input
            id="assets-bucket"
            value={draft.bucket}
            onChange={(e) => setDraft((prev) => ({ ...prev, bucket: e.target.value }))}
            maxLength={120}
            required={enabled}
          />
        </SettingsRow>
        <SettingsRow label="Access Key ID" htmlFor="assets-access-key-id">
          <Input
            id="assets-access-key-id"
            value={draft.accessKeyId}
            onChange={(e) => setDraft((prev) => ({ ...prev, accessKeyId: e.target.value }))}
            maxLength={255}
            autoComplete="off"
            required={enabled}
          />
        </SettingsRow>
        <SettingsRow
          label="Secret Access Key"
          htmlFor="assets-secret"
          hint={
            secretConfigured
              ? `当前已配置（结尾 …${assets.secretAccessKeyMask}）。留空保存表示保留现有 Secret，填入新值才会覆盖。`
              : '尚未配置。将以明文存入 setting 表，请确保数据库本身处于受控环境。'
          }
        >
          <Input
            id="assets-secret"
            type="password"
            value={draft.secretAccessKey}
            onChange={(e) => setDraft((prev) => ({ ...prev, secretAccessKey: e.target.value }))}
            placeholder={secretConfigured ? '保留现有 Secret' : '粘贴 Secret Access Key'}
            maxLength={512}
            autoComplete="new-password"
          />
        </SettingsRow>
        <SettingsRow
          label="Path-style 寻址"
          hint="部分自托管 S3 兼容服务（MinIO / 旧版 Ceph）需要开启；R2 / S3 默认走 virtual-hosted。"
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="assets-force-path-style"
              checked={draft.forcePathStyle}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, forcePathStyle: value === true }))}
            />
            <label htmlFor="assets-force-path-style" className="cursor-pointer text-sm">
              强制使用 path-style URL
            </label>
          </div>
        </SettingsRow>
        <SettingsRow
          label="图片地址模板（可选）"
          htmlFor="assets-url-template"
          hint="用于前端 `<Image />` 生成变换地址。支持 `{src}`、`{width}`、`{height}`、`{quality}` 占位符；不含 `{src}` 时会自动拼接在原 URL 后。"
        >
          <Input
            id="assets-url-template"
            value={draft.urlTemplate}
            onChange={(e) => setDraft((prev) => ({ ...prev, urlTemplate: e.target.value }))}
            maxLength={500}
            placeholder="!upyun520/both/{width}x{height}/format/webp/quality/{quality}/unsharp/true/progressive/true"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="上传参数" description="影响后台「图片管理」上传时的体积上限与 JPEG 重编码画质。">
        <SettingsRow
          label="最大上传体积（字节）"
          htmlFor="assets-max-bytes"
          hint="默认建议 8 MiB（8388608）。最大 50 MiB。"
        >
          <Input
            id="assets-max-bytes"
            type="number"
            min={1024}
            max={50 * 1024 * 1024}
            value={draft.maxBytes}
            onChange={(e) => setDraft((prev) => ({ ...prev, maxBytes: Number(e.target.value) || 0 }))}
            required
          />
        </SettingsRow>
        <SettingsRow
          label="默认 JPEG 质量"
          htmlFor="assets-jpeg-quality"
          hint="40-100 之间。后台上传时操作员可在此基础上微调，最终值与本字段无关；本字段控制服务端再编码时的 sharp.jpeg({ quality }) 参数。"
        >
          <Input
            id="assets-jpeg-quality"
            type="number"
            min={40}
            max={100}
            value={draft.jpegQuality}
            onChange={(e) => setDraft((prev) => ({ ...prev, jpegQuality: Number(e.target.value) || 0 }))}
            required
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
