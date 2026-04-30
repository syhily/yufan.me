import { type SubmitEventHandler, useCallback, useEffect, useMemo, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'

import type { ClearCacheOutput, GetCacheStatsOutput } from '@/client/api/action-types'
import type { ClearCacheTarget } from '@/server/cache/admin-service'
import type { CacheBucketId, CacheBucketStats } from '@/server/cache/buckets'
import type { BlogSettings } from '@/server/settings/defaults'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { API_ACTIONS } from '@/client/api/actions'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/admin/shadcn/components/ui/alert-dialog'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Input } from '@/ui/admin/shadcn/components/ui/input'

type CacheSlice = BlogSettings['settings']['cache']

interface CacheViewProps {
  stats: GetCacheStatsOutput
  cache: CacheSlice
  csrfToken: string
}

const CLEAR = API_ACTIONS.admin.clearCache

interface ClearStatus {
  state: 'idle' | 'pending' | 'success' | 'error'
  /** Last-clicked target so the per-bucket button can show "清空中…" only on itself. */
  target: ClearCacheTarget | null
  message: string | null
}

const idleStatus: ClearStatus = { state: 'idle', target: null, message: null }

// Cache management page. Each registered bucket lives in its own card
// that owns BOTH:
//   1. the editable prefix / TTL form (saved independently per card via
//      its own `useFetcher`), and
//   2. the SCAN stats + "清空该分组" button.
// A single "一键清空全部缓存" card stays at the top so editors can
// purge everything in one round-trip.
export function CacheView({ stats, cache, csrfToken }: CacheViewProps) {
  const fetcher = useFetcher<ApiEnvelope<ClearCacheOutput>>()
  const revalidator = useRevalidator()
  const [status, setStatus] = useState<ClearStatus>(idleStatus)
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

  // Drain fetcher results — `useFetcher` retains the last response in
  // `.data` after the request completes, so we react inside an effect
  // and reset the local status flag.
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data.error) {
      setStatus((prev) => ({
        state: 'error',
        target: prev.target,
        message: fetcher.data?.error?.message ?? '操作失败',
      }))
      return
    }
    const result = fetcher.data.data
    if (!result) return
    const summary =
      result.cleared.length === 1
        ? `已清空「${result.cleared[0]?.label ?? ''}」缓存（${result.cleared[0]?.removed ?? 0} 项）`
        : `已清空全部缓存（${result.total} 项）`
    setStatus((prev) => ({ state: 'success', target: prev.target, message: summary }))
    void revalidator.revalidate()
  }, [fetcher.state, fetcher.data, revalidator])

  const totalKeys = stats.buckets.reduce((sum, bucket) => sum + bucket.keyCount, 0)
  const isClearPending = fetcher.state !== 'idle'

  // Index the cache slice by bucket id so `BucketCard` can grab its
  // OWN current values without fishing through the parent.
  const cacheByBucket = useMemo<Record<CacheBucketId, CacheSlice[CacheBucketId]>>(
    () => ({ og: cache.og, calendar: cache.calendar, avatar: cache.avatar }),
    [cache],
  )

  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      {/*
       * Top-level wrapper carries `relative` so the desktop "全部清空"
       * button can `absolute`-pin to the card's bottom-right corner
       * (a "floating CTA" pattern — no separator line, the button
       * just hovers over the card chrome). On mobile the button
       * de-attaches from the corner and renders as a centered block
       * inside the normal flow.
       */}
      <div className="tw:relative">
        <SettingsSection
          title="一键清空"
          description={`SCAN 所有已注册的缓存键并通过 UNLINK 异步删除。当前共 ${totalKeys} 个键。`}
        >
          <p className="tw:text-muted-foreground tw:text-sm">
            清空后下一次访问会触发对应资源（OG 图、头像、日历）的重新生成 / 拉取。Session 与限流计数不会受影响。
          </p>
          {/*
           * Reserve right-side breathing room on desktop so the
           * floating CTA doesn't visually overlap "数据采集时间：…".
           * On mobile the floating button is hidden so no padding
           * trick is needed.
           */}
          <div className="tw:sm:pr-44">
            <CacheStatusLine status={status} target="all" generatedAt={stats.generatedAt} />
          </div>
          {/*
           * Mobile-only inline button: centered, full-flow, no
           * separator. Hidden on ≥sm — the desktop variant lives
           * outside `SettingsSection` as an absolutely-positioned
           * floating button (see below).
           */}
          <div className="tw:flex tw:justify-center tw:sm:hidden">
            <Button
              type="button"
              variant="destructive"
              disabled={isClearPending || totalKeys === 0}
              onClick={() => setConfirmTarget('all')}
            >
              {isClearPending && status.target === 'all' ? '清空中…' : '清空全部缓存'}
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
          className="tw:absolute tw:right-6 tw:bottom-6 tw:hidden tw:sm:inline-flex"
        >
          {isClearPending && status.target === 'all' ? '清空中…' : '清空全部缓存'}
        </Button>
      </div>

      {stats.buckets.map((bucket) => (
        <BucketCard
          key={bucket.id}
          bucket={bucket}
          settings={cacheByBucket[bucket.id]}
          allBuckets={cache}
          isClearPending={isClearPending}
          clearStatus={status}
          csrfToken={csrfToken}
          onClear={() => setConfirmTarget(bucket.id)}
        />
      ))}

      <ConfirmClearDialog
        open={confirmTarget !== null}
        target={confirmTarget}
        buckets={stats.buckets}
        onConfirm={() => {
          if (confirmTarget !== null) submitClear(confirmTarget)
          setConfirmTarget(null)
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}

// ----------------------------------------------------------------------
// Per-bucket card (config form + SCAN stats + clear button)
// ----------------------------------------------------------------------

interface BucketCardProps {
  bucket: CacheBucketStats
  /** This bucket's authoritative settings (server-side snapshot). */
  settings: { prefix: string; ttlSeconds: number }
  /**
   * The full cache slice — needed so a per-bucket save can re-send the
   * other two buckets unchanged (the cache section on the server is
   * atomic; we never want to nullify a bucket the editor isn't
   * touching).
   */
  allBuckets: CacheSlice
  isClearPending: boolean
  clearStatus: ClearStatus
  csrfToken: string
  onClear: () => void
}

interface BucketDraft {
  prefix: string
  ttlHours: number
}

const SECONDS_PER_HOUR = 60 * 60
const MIN_TTL_HOURS = 1
const MAX_TTL_HOURS = 24 * 30

// Mirror of the server-side conflict checks in `cacheSchema`. The
// authoritative validation lives on the server — this is a UX hint so
// the editor sees the problem before clicking save.
const PREFIX_PATTERN = /^[a-z0-9_-]+[-:]$/i
const RESERVED_PREFIXES: readonly string[] = ['session:', 'rate-limit:', 'avatar-status-']

function snapshotFromSettings(settings: { prefix: string; ttlSeconds: number }): BucketDraft {
  return {
    prefix: settings.prefix,
    ttlHours: Math.round(settings.ttlSeconds / SECONDS_PER_HOUR),
  }
}

function draftsEqual(a: BucketDraft, b: BucketDraft): boolean {
  return a.prefix === b.prefix && a.ttlHours === b.ttlHours
}

function validateBucket(
  draft: BucketDraft,
  bucketId: CacheBucketId,
  others: { id: CacheBucketId; prefix: string }[],
): string | null {
  function collides(a: string, b: string): boolean {
    return a === b || a.startsWith(b) || b.startsWith(a)
  }

  const trimmed = draft.prefix.trim()
  if (trimmed.length === 0) return '前缀不能为空'
  if (!PREFIX_PATTERN.test(trimmed)) {
    return '前缀只能包含字母 / 数字 / `_` / `-`，且必须以 `-` 或 `:` 结尾'
  }
  const reserved = RESERVED_PREFIXES.find((slot) => collides(trimmed, slot))
  if (reserved !== undefined) {
    return `与系统保留前缀 \`${reserved}\` 冲突，请换一个名字`
  }
  // Skip any "other" entry that happens to share this card's bucket
  // id (defensive — `allBuckets` is keyed by id so there shouldn't be
  // duplicates, but the loop reads more naturally with the guard).
  for (const other of others) {
    if (other.id === bucketId) continue
    if (collides(trimmed, other.prefix)) {
      return `与「${other.id}」的前缀 \`${other.prefix}\` 冲突，会让 SCAN 互相误伤`
    }
  }
  return null
}

function BucketCard({
  bucket,
  settings,
  allBuckets,
  isClearPending,
  clearStatus,
  csrfToken: _csrfToken,
  onClear,
}: BucketCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [snapshot, setSnapshot] = useState<BucketDraft>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<BucketDraft>(snapshot)
  // The "auto-exit on save" effect needs to fire exactly once per
  // successful save, not on every render where `status === 'saved'`.
  // Track whether THIS card initiated the most recent submission so a
  // sibling card's save (which we ignore) doesn't accidentally close
  // this one.
  const [savingFromHere, setSavingFromHere] = useState(false)

  // Re-baseline both snapshot and draft when the parent loader serves
  // a new authoritative value (e.g. after this card's own save, or
  // after another card's save which also revalidates the layout).
  // We only re-baseline the draft when NOT editing — otherwise a
  // sibling card's revalidation would silently overwrite the editor's
  // typed-but-unsaved values.
  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    if (!isEditing) {
      setDraft(fresh)
    }
  }, [settings, isEditing])

  const isDirty = !draftsEqual(draft, snapshot)
  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const {
    save,
    isPending: isSavePending,
    status: saveStatus,
    errorMessage,
  } = useSettingsFetcher({
    section: 'cache',
    onSaved,
  })

  // Auto-exit the edit mode on a successful save originated from this
  // card. The "saved" status sticks until the next submission, so we
  // gate on the `savingFromHere` flag (cleared once we've reacted).
  useEffect(() => {
    if (saveStatus === 'saved' && savingFromHere) {
      setIsEditing(false)
      setSavingFromHere(false)
    }
  }, [saveStatus, savingFromHere])

  // Build the "other buckets" view from the parent's `allBuckets`
  // every render — that way if a sibling card just saved a rename, the
  // conflict check on this card immediately reflects the new value.
  const otherBuckets = useMemo(() => {
    const all: { id: CacheBucketId; prefix: string }[] = [
      { id: 'og', prefix: allBuckets.og.prefix },
      { id: 'calendar', prefix: allBuckets.calendar.prefix },
      { id: 'avatar', prefix: allBuckets.avatar.prefix },
    ]
    return all.filter((entry) => entry.id !== bucket.id)
  }, [allBuckets, bucket.id])

  const validationError = useMemo(
    () => (isEditing ? validateBucket(draft, bucket.id, otherBuckets) : null),
    [isEditing, draft, bucket.id, otherBuckets],
  )

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (validationError !== null) return
    setSavingFromHere(true)
    // The cache section is atomic on the server — re-send the other
    // two buckets exactly as they came from the loader so a per-card
    // save can't accidentally clobber a sibling bucket.
    save({
      cache: {
        ...allBuckets,
        [bucket.id]: {
          prefix: draft.prefix.trim(),
          ttlSeconds: hoursToSeconds(draft.ttlHours),
        },
      },
    })
  }

  const onCancel = () => {
    setDraft(snapshot)
    setIsEditing(false)
  }

  const onEdit = () => {
    // Re-baseline draft to the latest server snapshot before opening
    // the form so the editor sees what's actually in effect (matters
    // when a sibling save just revalidated this card's `settings`
    // while in read-only mode).
    setDraft(snapshot)
    setIsEditing(true)
  }

  const isClearingSelf = isClearPending && clearStatus.target === bucket.id
  const prefixId = `cache-${bucket.id}-prefix`
  const ttlId = `cache-${bucket.id}-ttl`

  // Shared action-bar buttons rendered in BOTH read-only AND edit
  // modes. Visual ordering, left-to-right:
  //   1. "取消" (edit mode) / "编辑" (read-only mode) — entry / exit
  //      affordance for the form.
  //   2. "保存配置" (edit mode only) — the form's submit. Adjacent to
  //      its inverse (取消) so the pair reads as a single decision.
  //   3. "清空该分组" — pinned LAST so it always sits on the far
  //      right, regardless of whether the form is open. The
  //      destructive action stays in a stable spot the editor can
  //      always reach without scanning the bar's contents.
  const actionButtons = (
    <>
      {isEditing ? (
        <Button type="button" variant="ghost" disabled={isSavePending} onClick={onCancel}>
          取消
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled={isClearPending} onClick={onEdit}>
          编辑
        </Button>
      )}
      {isEditing ? (
        <Button type="submit" disabled={isSavePending || !isDirty || validationError !== null}>
          {isSavePending ? '保存中…' : '保存配置'}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="destructive-soft"
        disabled={isClearPending || isSavePending || bucket.keyCount === 0}
        onClick={onClear}
      >
        {isClearingSelf ? '清空中…' : '清空该分组'}
      </Button>
    </>
  )

  // Status line that lives next to the action buttons. In edit mode
  // it surfaces the form-level status (尚未保存 / 保存中 / 配置冲突
  // / 已保存 / 错误信息); in read-only mode it surfaces clear-status
  // or the post-save "配置已更新" hint.
  const statusLine = isEditing ? (
    <BucketSaveStatus
      isDirty={isDirty}
      isPending={isSavePending}
      status={saveStatus}
      errorMessage={errorMessage}
      validationError={validationError}
    />
  ) : (
    <ReadOnlyStatusLine
      clearStatus={clearStatus}
      target={bucket.id}
      savedHint={saveStatus === 'saved' && !isDirty ? '配置已更新' : undefined}
    />
  )

  // Bottom action bar shared by both modes. The submit button (only
  // present in edit mode) is rendered through `actionButtons` above
  // and naturally resolves to the surrounding `<form>` when editing
  // because the action bar lives inside that form. In read-only mode
  // the same markup is rendered as a plain footer div.
  const actionBar = (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-3 tw:border-t tw:pt-4">
      {statusLine ? <div className="tw:mr-auto">{statusLine}</div> : null}
      {actionButtons}
    </div>
  )

  return (
    <SettingsSection title={bucket.label} description={bucket.description}>
      <dl className="tw:grid tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        <Field label="Redis 键数" value={`${bucket.keyCount}`} />
        <Field label="当前前缀" value={<code className="tw:font-mono tw:text-xs">{bucket.prefix}</code>} />
        <Field label="SCAN 模式" value={<code className="tw:font-mono tw:text-xs">{bucket.pattern}</code>} />
        <Field label="当前 TTL" value={formatTtl(bucket.ttlSeconds)} />
      </dl>

      {isEditing ? (
        <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-4">
          <FieldRow
            label="键前缀"
            htmlFor={prefixId}
            hint="必须以 `-` 或 `:` 结尾，作为前缀和后续字段的分隔符。修改后写入端立即用新前缀生成键。"
            error={validationError ?? undefined}
          >
            <Input
              id={prefixId}
              value={draft.prefix}
              onChange={(e) => setDraft((prev) => ({ ...prev, prefix: e.target.value }))}
              placeholder={`${bucket.id}-`}
              maxLength={40}
              required
              aria-invalid={validationError !== null}
            />
          </FieldRow>
          <FieldRow
            label="TTL（小时）"
            htmlFor={ttlId}
            hint={`将以 ${draft.ttlHours * SECONDS_PER_HOUR} 秒写入 Redis（1 小时 ~ 30 天）。`}
          >
            <Input
              id={ttlId}
              type="number"
              min={MIN_TTL_HOURS}
              max={MAX_TTL_HOURS}
              value={draft.ttlHours}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  ttlHours: clamp(Number.parseInt(e.target.value, 10) || MIN_TTL_HOURS, MIN_TTL_HOURS, MAX_TTL_HOURS),
                }))
              }
            />
          </FieldRow>
          {actionBar}
        </form>
      ) : (
        actionBar
      )}
    </SettingsSection>
  )
}

interface ReadOnlyStatusLineProps {
  clearStatus: ClearStatus
  target: ClearCacheTarget
  savedHint: string | undefined
}

function ReadOnlyStatusLine({ clearStatus, target, savedHint }: ReadOnlyStatusLineProps) {
  // Pinned next to the action buttons so the editor sees the result
  // of the most recent operation (clear / save) without scrolling.
  // Returns null when there's nothing to say so the surrounding
  // `mr-auto` spacer collapses cleanly and the buttons hug the right
  // edge.
  if (clearStatus.target === target && clearStatus.state === 'success' && clearStatus.message) {
    return <span className="tw:text-muted-foreground tw:text-xs">{clearStatus.message}</span>
  }
  if (clearStatus.target === target && clearStatus.state === 'error' && clearStatus.message) {
    return <span className="tw:text-destructive tw:text-xs">{clearStatus.message}</span>
  }
  if (savedHint) {
    return <span className="tw:text-muted-foreground tw:text-xs">{savedHint}</span>
  }
  return null
}

interface BucketSaveStatusProps {
  isDirty: boolean
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
  validationError: string | null
}

function BucketSaveStatus({ isDirty, isPending, status, errorMessage, validationError }: BucketSaveStatusProps) {
  // Validation errors show under the input itself (`FieldRow.error`),
  // so the action-bar text only needs a one-liner status. Order
  // matters: pending > validation > server error > saved-clean > dirty.
  if (isPending) {
    return <span className="tw:text-muted-foreground tw:text-sm">保存中…</span>
  }
  if (validationError !== null) {
    return <span className="tw:text-destructive tw:text-sm">配置存在冲突，请先修正</span>
  }
  if (status === 'error') {
    return <span className="tw:text-destructive tw:text-sm">{errorMessage ?? '保存失败'}</span>
  }
  if (status === 'saved' && !isDirty) {
    return <span className="tw:text-muted-foreground tw:text-sm">已保存</span>
  }
  if (isDirty) {
    return <span className="tw:text-muted-foreground tw:text-sm">尚未保存的更改</span>
  }
  return <span className="tw:text-muted-foreground tw:text-sm">无更改</span>
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

interface FieldProps {
  label: string
  value: React.ReactNode
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      <dt className="tw:text-muted-foreground tw:text-xs tw:uppercase tw:tracking-wide">{label}</dt>
      <dd className="tw:text-foreground tw:text-sm">{value}</dd>
    </div>
  )
}

interface CacheStatusLineProps {
  status: ClearStatus
  target: ClearCacheTarget
  generatedAt?: string
}

function CacheStatusLine({ status, target, generatedAt }: CacheStatusLineProps) {
  // Status messages always live next to the action that triggered them
  // — render only when *this* card was the originator of the last
  // request. Otherwise show the snapshot timestamp (the "all" card)
  // or nothing.
  if (status.target === target && status.state === 'success' && status.message) {
    return <p className="tw:text-muted-foreground tw:text-xs">{status.message}</p>
  }
  if (status.target === target && status.state === 'error' && status.message) {
    return <p className="tw:text-destructive tw:text-xs">{status.message}</p>
  }
  if (generatedAt) {
    return <p className="tw:text-muted-foreground tw:text-xs">数据采集时间：{formatTimestamp(generatedAt)}</p>
  }
  return null
}

interface ConfirmClearDialogProps {
  open: boolean
  target: ClearCacheTarget | null
  buckets: CacheBucketStats[]
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmClearDialog({ open, target, buckets, onConfirm, onCancel }: ConfirmClearDialogProps) {
  const isAll = target === 'all'
  const bucket = !isAll && target ? buckets.find((entry) => entry.id === target) : null
  const total = isAll ? buckets.reduce((sum, entry) => sum + entry.keyCount, 0) : (bucket?.keyCount ?? 0)
  const title = isAll ? '清空全部缓存？' : `清空「${bucket?.label ?? ''}」缓存？`
  const description = isAll
    ? `本次操作会通过 SCAN 找出全部 ${total} 个 Redis 键并 UNLINK 删除。下一次访问 OG 图 / 头像 / 日历会重新生成或拉取，可能短时间内增加服务器负载。该操作不可撤销。`
    : `本次操作会通过 SCAN 找出 ${total} 个匹配 ${bucket?.pattern ?? ''} 的 Redis 键并 UNLINK 删除。该操作不可撤销。`

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? null : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{isAll ? '确认清空全部' : '确认清空'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Render the stored TTL in the most readable unit. The form uses
// hours, but a "1 day" / "7 days" string reads better at a glance on
// the per-bucket card.
function formatTtl(seconds: number): string {
  const totalHours = Math.round(seconds / 3600)
  if (totalHours >= 24 && totalHours % 24 === 0) {
    const days = totalHours / 24
    return `${days} 天`
  }
  return `${totalHours} 小时`
}

// Format the snapshot timestamp purely on the client to avoid an SSR /
// hydration mismatch on locales / time zones. We only need a short
// "HH:MM:SS" suffix because the page is interactive and the operator
// will see when it changes.
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString()
  } catch {
    return iso
  }
}

function hoursToSeconds(hours: number): number {
  return Math.max(MIN_TTL_HOURS, Math.min(MAX_TTL_HOURS, Math.trunc(hours))) * SECONDS_PER_HOUR
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

// Re-export the bucket id type for any consumer that wants to render a
// custom bucket-aware UI without re-importing from the server module.
export type { CacheBucketId }
