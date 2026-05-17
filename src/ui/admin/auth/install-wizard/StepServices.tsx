import type { StepProps } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export function StepServices(_props: StepProps) {
  const { data, updateData } = useInstallWizard()

  return (
    <div className="flex flex-col gap-5">
      {/* CDN / Asset Host */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-asset-host">CDN 域名</Label>
        <Input
          id="w-asset-host"
          value={data.assets.asset.host}
          onChange={(e) =>
            updateData((prev) => ({
              ...prev,
              assets: { ...prev.assets, asset: { ...prev.assets.asset, host: e.target.value } },
            }))
          }
          placeholder="cdn.example.com"
        />
        <p className="text-xs text-muted-foreground">资源（图片、音乐元数据）的 CDN 域名。</p>
      </div>

      {/* S3 Storage */}
      <div className="flex flex-col gap-3 rounded-sm border border-line p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="w-s3-enabled"
            checked={data.assets.storage.enabled}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                assets: {
                  ...prev.assets,
                  storage: { ...prev.assets.storage, enabled: e.target.checked },
                },
              }))
            }
            className="h-4 w-4"
          />
          <Label htmlFor="w-s3-enabled" className="cursor-pointer font-medium">
            启用 S3 / R2 对象存储
          </Label>
        </div>

        {data.assets.storage.enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-s3-endpoint">Endpoint</Label>
              <Input
                id="w-s3-endpoint"
                type="url"
                value={data.assets.storage.endpoint}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    assets: {
                      ...prev.assets,
                      storage: { ...prev.assets.storage, endpoint: e.target.value },
                    },
                  }))
                }
                placeholder="https://s3.amazonaws.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-s3-region">Region</Label>
              <Input
                id="w-s3-region"
                value={data.assets.storage.region}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    assets: {
                      ...prev.assets,
                      storage: { ...prev.assets.storage, region: e.target.value },
                    },
                  }))
                }
                placeholder="us-east-1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-s3-bucket">Bucket</Label>
              <Input
                id="w-s3-bucket"
                value={data.assets.storage.bucket}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    assets: {
                      ...prev.assets,
                      storage: { ...prev.assets.storage, bucket: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-s3-key">Access Key ID</Label>
              <Input
                id="w-s3-key"
                value={data.assets.storage.accessKeyId}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    assets: {
                      ...prev.assets,
                      storage: { ...prev.assets.storage, accessKeyId: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="w-s3-secret">Secret Access Key</Label>
              <Input
                id="w-s3-secret"
                type="password"
                value={data.assets.storage.secretAccessKey}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    assets: {
                      ...prev.assets,
                      storage: { ...prev.assets.storage, secretAccessKey: e.target.value },
                    },
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Upload limits */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-upload-max">上传大小限制（字节）</Label>
          <Input
            id="w-upload-max"
            type="number"
            value={data.assets.upload.maxBytes}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                assets: {
                  ...prev.assets,
                  upload: { ...prev.assets.upload, maxBytes: Number(e.target.value) },
                },
              }))
            }
            min={1024}
            max={50 * 1024 * 1024}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-upload-quality">图片压缩质量</Label>
          <Input
            id="w-upload-quality"
            type="number"
            value={data.assets.upload.jpegQuality}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                assets: {
                  ...prev.assets,
                  upload: { ...prev.assets.upload, jpegQuality: Number(e.target.value) },
                },
              }))
            }
            min={40}
            max={100}
          />
        </div>
      </div>

      {/* Mail */}
      <div className="flex flex-col gap-3 rounded-sm border border-line p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="w-mail-enabled"
            checked={data.mail.enabled}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                mail: { ...prev.mail, enabled: e.target.checked },
              }))
            }
            className="h-4 w-4"
          />
          <Label htmlFor="w-mail-enabled" className="cursor-pointer font-medium">
            启用邮件通知
          </Label>
        </div>

        {data.mail.enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-mail-host">邮件服务主机</Label>
              <Input
                id="w-mail-host"
                value={data.mail.host}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    mail: { ...prev.mail, host: e.target.value },
                  }))
                }
                placeholder="api.zeabur.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-mail-sender">发件人邮箱</Label>
              <Input
                id="w-mail-sender"
                type="email"
                value={data.mail.sender}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    mail: { ...prev.mail, sender: e.target.value },
                  }))
                }
                placeholder="noreply@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="w-mail-key">API Key</Label>
              <Input
                id="w-mail-key"
                type="password"
                value={data.mail.apiKey}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    mail: { ...prev.mail, apiKey: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 rounded-sm border border-line p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="w-search-enabled"
            checked={data.search.enabled}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                search: { ...prev.search, enabled: e.target.checked },
              }))
            }
            className="h-4 w-4"
          />
          <Label htmlFor="w-search-enabled" className="cursor-pointer font-medium">
            启用高级搜索
          </Label>
        </div>

        {data.search.enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-search-mode">搜索模式</Label>
              <select
                id="w-search-mode"
                value={data.search.mode}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    search: { ...prev.search, mode: e.target.value as 'vector' | 'like' },
                  }))
                }
                className="h-9 rounded-sm border border-line bg-transparent px-2 text-sm"
              >
                <option value="like">关键词搜索（数据库 LIKE）</option>
                <option value="vector">向量搜索（OpenAI 嵌入）</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-search-model">嵌入模型</Label>
              <Input
                id="w-search-model"
                value={data.search.model}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    search: { ...prev.search, model: e.target.value },
                  }))
                }
                placeholder="text-embedding-3-small"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-search-endpoint">API 端点（可选）</Label>
              <Input
                id="w-search-endpoint"
                type="url"
                value={data.search.endpoint}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    search: { ...prev.search, endpoint: e.target.value },
                  }))
                }
                placeholder="留空使用 OpenAI 官方端点"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="w-search-threshold">相似度阈值</Label>
              <Input
                id="w-search-threshold"
                type="number"
                step={0.01}
                value={data.search.similarityThreshold}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    search: { ...prev.search, similarityThreshold: Number(e.target.value) },
                  }))
                }
                min={0}
                max={1}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="w-search-key">API Key</Label>
              <Input
                id="w-search-key"
                type="password"
                value={data.search.apiKey}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    search: { ...prev.search, apiKey: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
