import { CheckIcon, Loader2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { SearchLoaderShape } from '@/shared/settings'

import { api } from '@/client/api/client'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/button'
import { Checkbox } from '@/ui/components/checkbox'
import { Input } from '@/ui/components/input'

export type { SearchLoaderShape }

interface FormState {
  enabled: boolean
  mode: 'vector' | 'like'
  endpoint: string
  apiKey: string
  model: string
  similarityThreshold: number
}

interface SearchFormProps {
  search: SearchLoaderShape
}

type ReindexPhase = 'idle' | 'running' | 'success'

interface ReindexProgress {
  phase: ReindexPhase
  total: number
  processed: number
  failed: number
}

export function SearchForm({ search }: SearchFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    SearchLoaderShape,
    FormState
  >({
    section: 'search',
    source: search,
    toState: (source) => ({
      enabled: source.search.enabled,
      mode: source.search.mode,
      endpoint: source.search.endpoint ?? '',
      apiKey: '',
      model: source.search.model,
      similarityThreshold: source.search.similarityThreshold,
    }),
    fromState: (state) => {
      const trimmedKey = state.apiKey.trim()
      const payload: Record<string, unknown> = {
        enabled: state.enabled,
        mode: state.mode,
        endpoint: state.endpoint.trim(),
        model: state.model.trim(),
        similarityThreshold: state.similarityThreshold,
      }
      if (trimmedKey) {
        payload.apiKey = trimmedKey
      }
      return { search: payload }
    },
  })

  const apiKeyConfigured = search.apiKeyMask !== null
  const enabled = draft.enabled

  const [reindex, setReindex] = useState<ReindexProgress>({
    phase: 'idle',
    total: 0,
    processed: 0,
    failed: 0,
  })

  useEffect(() => {
    if (reindex.phase === 'success') {
      const timer = setTimeout(() => {
        setReindex({ phase: 'idle', total: 0, processed: 0, failed: 0 })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [reindex.phase])

  async function handleReindex() {
    setReindex({ phase: 'running', total: 0, processed: 0, failed: 0 })

    let offset = 0
    let total = 0
    let processed = 0
    let failed = 0

    try {
      while (true) {
        const result = await api.admin.search.reindex({ body: { batchSize: 5, offset } })

        if (result.status !== 200) {
          const errBody = result.body as { error?: { message?: string } } | undefined
          throw new Error(errBody?.error?.message || `HTTP ${result.status}`)
        }

        const data = result.body
        total = data.total
        processed += data.processed
        failed += data.failed
        offset = data.nextOffset ?? total

        setReindex({ phase: 'running', total, processed, failed })

        if (data.nextOffset === null) {
          break
        }
      }

      setReindex({ phase: 'success', total, processed, failed })
    } catch (err) {
      console.error('Reindex failed:', err)
      setReindex({ phase: 'idle', total: 0, processed: 0, failed: 0 })
      toast.error(err instanceof Error ? err.message : '索引重建失败')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="搜索模式"
        description="选择文章搜索的底层实现。LIKE 模式仅依赖 Postgres，无需外部 API；向量模式需要 OpenAI API Key 并将调用 Embedding 接口。"
      >
        <SettingsRow
          label="启用 AI 向量搜索"
          hint="关闭时所有搜索请求都会降级为 Postgres LIKE 查询，无需 OpenAI 配置。"
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="search-enabled"
              checked={enabled}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value === true }))}
            />
            <label htmlFor="search-enabled" className="cursor-pointer text-sm">
              {enabled ? '已开启 — 使用 OpenAI Embedding 生成向量' : '已关闭 — 使用 Postgres LIKE 搜索'}
            </label>
          </div>
        </SettingsRow>

        <SettingsRow label="搜索模式" htmlFor="search-mode">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="search-mode"
                value="like"
                checked={draft.mode === 'like'}
                onChange={() => setDraft((prev) => ({ ...prev, mode: 'like' }))}
              />
              LIKE（纯 Postgres）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="search-mode"
                value="vector"
                checked={draft.mode === 'vector'}
                onChange={() => setDraft((prev) => ({ ...prev, mode: 'vector' }))}
              />
              向量（OpenAI + pgvector）
            </label>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="OpenAI 配置"
        description={
          enabled ? '向量搜索需要调用 OpenAI Embedding API。' : '当前未启用向量搜索，可提前填好配置，开启后立即生效。'
        }
      >
        <SettingsRow
          label="API Endpoint"
          htmlFor="search-endpoint"
          hint="留空表示使用官方 OpenAI 接口（https://api.openai.com/v1）。支持任意兼容 OpenAI API 规范的第三方服务。"
        >
          <Input
            id="search-endpoint"
            type="url"
            value={draft.endpoint}
            onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            maxLength={253}
          />
        </SettingsRow>

        <SettingsRow
          label="API Key"
          htmlFor="search-api-key"
          hint={
            apiKeyConfigured
              ? `当前已配置（结尾 …${search.apiKeyMask}）。留空保存表示保留现有 Key，填入新值才会覆盖。`
              : '尚未配置。将以明文存入 setting 表，请确保数据库本身处于受控环境。'
          }
        >
          <Input
            id="search-api-key"
            type="password"
            value={draft.apiKey}
            onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={apiKeyConfigured ? '保留现有 Key' : '粘贴 OpenAI API Key'}
            maxLength={512}
            autoComplete="new-password"
          />
        </SettingsRow>

        <SettingsRow
          label="模型"
          htmlFor="search-model"
          hint={
            <>
              <span>默认 text-embedding-3-small，性价比最高。text-embedding-3-large 质量更好但成本更高。</span>
              <span className="block text-status-warn-fg">
                系统固定请求 1536 维向量输出，请确保所选模型支持 dimensions 参数或本身输出 1536 维。
              </span>
            </>
          }
        >
          <Input
            id="search-model"
            value={draft.model}
            onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="text-embedding-3-small"
            maxLength={80}
          />
        </SettingsRow>

        <SettingsRow
          label="相似度阈值"
          htmlFor="search-threshold"
          hint="0–1 之间。越高结果越精准，但可能漏掉部分相关内容。建议 0.5–0.7。"
        >
          <Input
            id="search-threshold"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={draft.similarityThreshold}
            onChange={(e) => setDraft((prev) => ({ ...prev, similarityThreshold: Number(e.target.value) || 0 }))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="索引管理" description="首次启用向量搜索或批量更新文章后，需要重建搜索索引。">
        <SettingsRow label="重建搜索索引">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={reindex.phase === 'running'}
              onClick={() => {
                void handleReindex()
              }}
            >
              {reindex.phase === 'running' && <Loader2Icon className="animate-spin" />}
              {reindex.phase === 'success' && <CheckIcon className="text-status-success-fg" />}
              {reindex.phase === 'idle' && '重建索引'}
              {reindex.phase === 'running' && '索引中...'}
              {reindex.phase === 'success' && '完成'}
            </Button>
            {reindex.phase === 'running' && (
              <span className="text-sm text-muted-foreground">
                等待 {Math.max(0, reindex.total - reindex.processed - reindex.failed)} / 成功 {reindex.processed} / 失败{' '}
                {reindex.failed}（共 {reindex.total}）
              </span>
            )}
            {reindex.phase === 'success' && (
              <span className="text-sm text-status-success-fg">
                索引重建完成：成功 {reindex.processed} / 失败 {reindex.failed}（共 {reindex.total}）
              </span>
            )}
          </div>
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
