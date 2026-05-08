import { Music2Icon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AdminMusicDto, ListMusicInput, ListMusicOutput } from '@/shared/music'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'

const LIST_MUSIC = API_ACTIONS.admin.listMusic

// Music picker. Pulls from the local admin library; new tracks have
// to be added through `/wp-admin/musics` first (search +
// `addMusic`). The picker only lists what's already imported, which
// keeps the editor surface focused.

export interface MusicPickerDialogProps {
  trigger?: React.ReactNode
  onPick: (music: AdminMusicDto) => void
}

export function MusicPickerDialog({ trigger, onPick }: MusicPickerDialogProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [musics, setMusics] = useState<AdminMusicDto[] | null>(null)

  const fetcher = useApiFetcher<ListMusicInput, ListMusicOutput>(LIST_MUSIC, {
    onSuccess: (payload) => setMusics(payload.musics),
  })

  useEffect(() => {
    if (open && musics === null) {
      fetcher.load({ limit: 60 })
    }
  }, [open, musics, fetcher])

  useEffect(() => {
    if (!open) {
      return
    }
    const handle = setTimeout(() => {
      setMusics(null)
      fetcher.load({ limit: 60, q: q.trim() === '' ? undefined : q.trim() })
    }, 300)
    return () => clearTimeout(handle)
  }, [q, open, fetcher])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger !== undefined ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" type="button">
              <Music2Icon /> 选择音乐
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择音乐</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按曲名 / 演唱者搜索"
            className="max-w-md"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {musics === null ? (
            <div className="p-8 text-center text-sm text-muted-foreground">加载中…</div>
          ) : musics.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              没有匹配的音乐。请先到 /wp-admin/musics 添加。
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {musics.map((music) => (
                <MusicRow
                  key={music.id}
                  music={music}
                  onClick={() => {
                    onPick(music)
                    setOpen(false)
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface MusicRowProps {
  music: AdminMusicDto
  onClick: () => void
}

function MusicRow({ music, onClick }: MusicRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-md border bg-card p-2 text-left transition hover:border-primary"
      >
        <img
          src={music.coverUrl}
          alt={music.name}
          loading="lazy"
          decoding="async"
          className="size-12 shrink-0 rounded object-cover"
        />
        <div className="grow truncate">
          <div className="truncate text-sm font-medium">{music.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {music.artist.join(', ')} · {music.album}
          </div>
        </div>
        <code className="font-mono text-[10px] text-muted-foreground">{music.playerId}</code>
      </button>
    </li>
  )
}
