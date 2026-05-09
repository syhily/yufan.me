import { ImageIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { AdminImageDto, ListImagesInput, ListImagesOutput } from '@/shared/images'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { cn } from '@/ui/lib/cn'

const LIST_IMAGES = API_ACTIONS.admin.listImages

// Image picker dialog driven by `admin.listImages`. The trigger is a
// caller-supplied React element (defaults to a "选择图片" button) so
// the dialog can sit anywhere — embedded in a row of the editor
// toolbar or in a property panel. `onPick` receives the full
// `AdminImageDto` so the caller has both `publicUrl` and
// `storagePath` available without a second round trip.

export interface ImageLibraryPickerProps {
  trigger?: React.ReactNode
  onPick: (image: AdminImageDto) => void
}

export function ImageLibraryPicker({ trigger, onPick }: ImageLibraryPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [images, setImages] = useState<AdminImageDto[] | null>(null)

  const { load } = useApiFetcher<ListImagesInput, ListImagesOutput>(LIST_IMAGES, {
    onSuccess: (payload) => setImages(payload.images),
  })

  // Debounced search: refetch 300ms after the last keystroke. We
  // keep a ref to the last query we issued a fetch for so a setState
  // round-trip from the response doesn't kick off another fetch.
  const lastFetchedQRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      lastFetchedQRef.current = null
      return
    }
    const trimmed = q.trim()
    if (lastFetchedQRef.current === trimmed) {
      return
    }
    const handle = setTimeout(
      () => {
        lastFetchedQRef.current = trimmed
        setImages(null)
        load({ kind: 'generic', limit: 60, q: trimmed === '' ? undefined : trimmed })
      },
      lastFetchedQRef.current === null ? 0 : 300,
    )
    return () => clearTimeout(handle)
  }, [q, open, load])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger !== undefined ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" type="button">
              <ImageIcon /> 选择图片
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>从图片库选择</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按文件名 / 备注搜索"
            className="max-w-md"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {images === null ? (
            <div className="p-8 text-center text-sm text-muted-foreground">加载中…</div>
          ) : images.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">没有匹配的图片</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => (
                <ImageTile
                  key={image.id}
                  image={image}
                  onClick={() => {
                    onPick(image)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ImageTileProps {
  image: AdminImageDto
  onClick: () => void
}

function ImageTile({ image, onClick }: ImageTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-md border bg-muted/30',
        'transition hover:ring-2 hover:ring-primary',
      )}
      title={image.storagePath}
    >
      <img
        src={image.publicUrl}
        alt={image.note ?? image.storagePath}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
      <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        {image.width}×{image.height}
      </span>
    </button>
  )
}
