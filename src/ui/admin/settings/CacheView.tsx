import { Trash2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'

import type { ApiEnvelope } from '@/client/api/fetcher'
import type { ClearCacheOutput, GetCacheStatsOutput } from '@/client/api/fetcher'
import type { CacheSettings } from '@/shared/blog-config'
import type { CacheBucketId, ClearCacheTarget, ReservedCacheBucketStats } from '@/shared/cache-types'

import { API_ACTIONS, useFetcherResult } from '@/client/api/fetcher'
import { BucketCard } from '@/ui/admin/settings/cache/BucketCard'
import { type ClearStatus, idleClearStatus } from '@/ui/admin/settings/cache/cache-status'
import { CacheStatusLine } from '@/ui/admin/settings/cache/CacheStatusLine'
import { ConfirmClearDialog } from '@/ui/admin/settings/cache/ConfirmClearDialog'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { Button } from '@/ui/components/button'

type CacheSlice = CacheSettings['cache']

interface CacheViewProps {
  stats: GetCacheStatsOutput
  cache: CacheSlice
}

const CLEAR = API_ACTIONS.admin.clearCache

// Cache management page. Composes:
//   1. A "一键清空" hero card with a floating CTA.
//   2. Per-bucket cards (`BucketCard`) for the editable prefix / TTL
//      form, SCAN stats, and the bucket-scoped clear button.
//   3. A single `ConfirmClearDialog` reused by every clear action.
//
// The previous version inlined every helper / sub-component (~680
// lines in one file). Each piece now lives next to its sibling under
// `./cache/`, and `CacheView` itself is left to do nothing but
// orchestration: own the fetcher, dispatch `submitClear` / confirm
// flows, and hand each bucket its slice of the cache.
export function CacheView({ stats, cache }: CacheViewProps) {
  const fetcher = useFetcher<ApiEnvelope<ClearCacheOutput>>()
  const revalidator = useRevalidator()
  const [status, setStatus] = useState<ClearStatus>(idleClearStatus)
  const [confirmTarget, setConfirmTarget] = useState<ClearCacheTarget | null>(null)

  const submitClear = useCallback(
    (target: ClearCacheTarget) => {
      setStatus({ state: 'pending', target, message: null })
      void fetcher.submit({ target } as never, {
        method: CLEAR.method,
        encType: 'application/json',
        action: CLEAR.path,
      })
    },
    [fetcher],
  )

  useFetcherResult(fetcher, {
    action: CLEAR,
    onError: (error) => {
      setStatus((prev) => ({
        state: 'error',
        target: prev.target,
        message: error.message || '操作失败',
      }))
    },
    onSuccess: (result) => {
      const summary =
        result.cleared.length === 1
          ? `已清空「${result.cleared[0]?.label ?? ''}」缓存（${result.cleared[0]?.removed ?? 0} 项）`
          : `已清空全部缓存（${result.total} 项）`
      setStatus((prev) => ({ state: 'success', target: prev.target, message: summary }))
      void revalidator.revalidate()
    },
  })

  const totalKeys = stats.buckets.reduce((sum: number, bucket: ReservedCacheBucketStats) => sum + bucket.keyCount, 0)
  const isClearPending = fetcher.state !== 'idle'

  // `cache` is already a primitive-value map keyed by bucket id, so
  // `BucketCard` can read its own slice directly as `cache[bucket.id]`.
  // Wrapping that into a `useMemo`-produced lookup object only
  // manufactured a fresh reference on every parent re-render without
  // saving any work — see `rerender-simple-expression-in-memo`.

  return (
    <div className="flex flex-col gap-6">
      {/*
       * Top-level wrapper carries `relative` so the desktop "全部清空"
       * button can `absolute`-pin to the card's bottom-right corner
       * (a "floating CTA" pattern — no separator line, the button
       * just hovers over the card chrome). On mobile the button
       * de-attaches from the corner and renders as a centered block
       * inside the normal flow.
       */}
      <div className="relative">
        <SettingsSection
          title="一键清空"
          description={`SCAN 所有已注册的缓存键并通过 UNLINK 异步删除。当前共 ${totalKeys} 个键。`}
        >
          <p className="text-sm text-muted-foreground">
            清空后下一次访问会触发对应资源（OG 图、头像、日历）的重新生成 / 拉取。Session 与限流计数不会受影响。
          </p>
          {/*
           * Reserve right-side breathing room on desktop so the
           * floating CTA doesn't visually overlap "数据采集时间：…".
           * On mobile the floating button is hidden so no padding
           * trick is needed.
           */}
          <div className="sm:pr-44">
            <CacheStatusLine status={status} target="all" generatedAt={stats.generatedAt} />
          </div>
          {/*
           * Mobile-only inline button: centered, full-flow, no
           * separator. Hidden on ≥sm — the desktop variant lives
           * outside `SettingsSection` as an absolutely-positioned
           * floating button (see below).
           */}
          <div className="flex justify-center sm:hidden">
            <Button
              type="button"
              variant="destructive"
              disabled={isClearPending || totalKeys === 0}
              onClick={() => setConfirmTarget('all')}
            >
              <Trash2Icon data-icon /> {isClearPending && status.target === 'all' ? '清空中…' : '清空全部缓存'}
            </Button>
          </div>
        </SettingsSection>
        {/*
         * Desktop floating CTA: pinned to the card's bottom-right
         * corner via `absolute` + the parent `relative` wrapper. The
         * `right-6 bottom-6` matches the card's internal `px-6 py-6`
         * padding so the button visually sits inside the card edge.
         */}
        <Button
          type="button"
          variant="destructive"
          disabled={isClearPending || totalKeys === 0}
          onClick={() => setConfirmTarget('all')}
          className="absolute right-6 bottom-6 hidden sm:inline-flex"
        >
          <Trash2Icon data-icon /> {isClearPending && status.target === 'all' ? '清空中…' : '清空全部缓存'}
        </Button>
      </div>

      {stats.buckets.map((bucket: ReservedCacheBucketStats) => (
        <BucketCard
          key={bucket.id}
          bucket={bucket}
          settings={cache[bucket.id]}
          allBuckets={cache}
          isClearPending={isClearPending}
          clearStatus={status}
          onClear={() => setConfirmTarget(bucket.id)}
        />
      ))}

      <ReservedBucketsSection reserved={stats.reserved} />

      <ConfirmClearDialog
        open={confirmTarget !== null}
        target={confirmTarget}
        buckets={stats.buckets}
        onConfirm={() => {
          if (confirmTarget !== null) {
            submitClear(confirmTarget)
          }
          setConfirmTarget(null)
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}

// Re-export the bucket id type for any consumer that wants to render a
// custom bucket-aware UI without re-importing from the server module.
export type { CacheBucketId }

// Read-only display for cache surfaces that the admin must NOT clear
// from the UI: `session:*` (clearing logs everyone out) and
// `rate-limit:*` (clearing lets throttled abusers retry immediately).
// We surface them for visibility only — current key count, prefix,
// description — so an operator can see them growing without exposing
// a foot-gun. Renaming / clearing stays administrative-tool territory
// (vp shells / Redis CLI).
function ReservedBucketsSection({ reserved }: { reserved: ReservedCacheBucketStats[] }) {
  return (
    <SettingsSection
      title="受保护的缓存（只读）"
      description="以下缓存关键到运行时安全，仅作可视化展示，不支持改名或清空。如确需操作，请通过 `vp` 或 Redis CLI 进行。"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {reserved.map((bucket: ReservedCacheBucketStats) => (
          <div key={bucket.id} className="rounded-md border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">{bucket.label}</h3>
              <span className="font-mono text-xs text-muted-foreground">{bucket.prefix}*</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{bucket.description}</p>
            <p className="mt-3 text-xs">
              <span className="text-muted-foreground">当前键数：</span>
              <span className="font-medium">{bucket.keyCount}</span>
            </p>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}
