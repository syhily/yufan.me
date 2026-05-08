import { Loader2Icon, PlayIcon, PlusIcon, SearchIcon, SquareIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  AddMusicInput,
  AddMusicOutput,
  AdminMusicDto,
  MetingSearchHit,
  SearchMusicInput,
  SearchMusicOutput,
} from '@/shared/music'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/components/ui/input-group'
import { Skeleton } from '@/ui/components/ui/skeleton'

const SEARCH = API_ACTIONS.admin.searchMusic
const ADD = API_ACTIONS.admin.addMusic

export interface AddMusicDialogProps {
  open: boolean
  onClose: () => void
  /**
   * Fires after each successful "添加" so the parent list can prepend
   * the new row. The dialog stays open after each add to support
   * adding several songs in sequence.
   */
  onAdded: (music: AdminMusicDto) => void
}

// Add-music dialog. Search is keyed on the netease provider only —
// see `MetingSource` in `@/shared/music` and the rationale in the
// plan: meting's per-provider responses diverge enough that we
// commit to a single provider for the first iteration.
//
// Workflow:
//   1. Operator types a keyword → `searchMusic` returns 10 hits, each
//      pre-resolved with `coverUrl` (small thumb) and `previewUrl`
//      (short-lived netease CDN link).
//   2. Operator clicks "试听" → an inline `<audio>` plays the preview
//      URL directly. We never persist the previewUrl.
//   3. Operator clicks "添加" → `addMusic({ source, sourceId })` and
//      the row gets prepended to the parent list. Dialog stays open.
export function AddMusicDialog({ open, onClose, onAdded }: AddMusicDialogProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<MetingSearchHit[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null)
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const searchApi = useApiFetcher<SearchMusicInput, SearchMusicOutput>(SEARCH, {
    onSuccess: (payload) => {
      setErrorMessage(null)
      setResults(payload.results)
    },
    onError: (error) => setErrorMessage(error.message),
  })
  const { load: loadSearch, isPending: isSearching } = searchApi

  const addApi = useApiFetcher<AddMusicInput, AddMusicOutput>(ADD, {
    onSuccess: (payload) => {
      setErrorMessage(null)
      setAddingSourceId(null)
      onAdded(payload.music)
      // Mark the just-added hit so the list shows a clear "已添加" cue.
      setResults(
        (prev) =>
          prev.map((hit) => (hit.sourceId === payload.music.sourceId ? { ...hit, _added: true } : hit)) as typeof prev,
      )
    },
    onError: (error) => {
      setAddingSourceId(null)
      setErrorMessage(error.message)
    },
  })
  const { submit: submitAdd } = addApi

  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
      setErrorMessage(null)
      setAddingSourceId(null)
      setPreviewSourceId(null)
      const audio = audioRef.current
      if (audio !== null) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
    }
  }, [open])

  const triggerSearch = useCallback(() => {
    const trimmed = keyword.trim()
    if (trimmed === '') {
      setResults([])
      setErrorMessage(null)
      return
    }
    loadSearch({ keyword: trimmed, limit: 10 })
  }, [keyword, loadSearch])

  const onPreview = useCallback(
    (hit: MetingSearchHit & { previewUrl?: string }) => {
      const audio = audioRef.current
      const previewUrl = hit.previewUrl
      if (audio === null || previewUrl === undefined || previewUrl === '') {
        return
      }
      if (previewSourceId === hit.sourceId) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        setPreviewSourceId(null)
        return
      }
      audio.src = previewUrl
      audio.play().catch(() => undefined)
      setPreviewSourceId(hit.sourceId)
    },
    [previewSourceId],
  )

  const onAdd = useCallback(
    (hit: MetingSearchHit) => {
      if (addingSourceId !== null) {
        return
      }
      setAddingSourceId(hit.sourceId)
      submitAdd({ source: hit.source, sourceId: hit.sourceId })
    },
    [addingSourceId, submitAdd],
  )

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加音乐</DialogTitle>
          <DialogDescription>
            通过 NetEase 搜索；点击「试听」可在浏览器中预览，「添加」会下载音频与封面到本站 S3 并入库。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              triggerSearch()
            }}
          >
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="例：Adele Hello、稻香、夜曲"
              />
            </InputGroup>
            <Button type="submit" disabled={isSearching || keyword.trim() === ''}>
              {isSearching ? <Loader2Icon className="animate-spin" /> : <SearchIcon />} 搜索
            </Button>
          </form>

          {errorMessage !== null ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            {isSearching && results.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-md" />)
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">输入关键词后点击搜索。</p>
            ) : (
              results.map((hit) => {
                const decorated = hit as MetingSearchHit & { previewUrl?: string; _added?: boolean }
                const previewActive = previewSourceId === hit.sourceId
                const adding = addingSourceId === hit.sourceId
                const added = decorated._added === true
                return (
                  <div key={hit.sourceId} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
                    {hit.coverUrl !== '' ? (
                      // The cover URL is a third-party CDN link; rendered
                      // directly because the search list does not benefit
                      // from going through the local image pipeline.
                      <img src={hit.coverUrl} alt="" className="size-12 shrink-0 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="size-12 shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{hit.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hit.artist.join(' / ')}
                        {hit.album !== '' ? ` · ${hit.album}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onPreview(decorated)}
                        disabled={decorated.previewUrl === undefined || decorated.previewUrl === ''}
                      >
                        {previewActive ? <SquareIcon /> : <PlayIcon />}
                        {previewActive ? '停止' : '试听'}
                      </Button>
                      <Button type="button" size="sm" onClick={() => onAdd(hit)} disabled={adding || added}>
                        {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                        {added ? '已添加' : adding ? '添加中' : '添加'}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Hidden inline preview audio. Rendered once and re-targeted as the
              admin clicks 「试听」; pause + clear on dialog close. */}
          <audio
            ref={audioRef}
            onEnded={() => setPreviewSourceId(null)}
            onPause={() => {
              if (audioRef.current !== null && audioRef.current.currentTime === 0) {
                setPreviewSourceId(null)
              }
            }}
          >
            <track kind="captions" />
          </audio>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            <XIcon /> 关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
