import { ImageIcon, SearchIcon, UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { AdminImageDto, ListImagesInput, ListImagesOutput } from '@/shared/images'

import { API_ACTIONS, useApiFetcher } from '@/client/api/fetcher'
import { UploadImageDialog } from '@/ui/admin/shared/UploadImageDialog'
import { Button } from '@/ui/components/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/components/dialog'
import { Input } from '@/ui/components/input'
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
  /**
   * Optional controlled-open pair. Pass when the caller wants to
   * drive the dialog imperatively (e.g. a slash-command in the
   * editor) instead of relying on a `trigger` button click. When
   * `open` is provided, `trigger` becomes optional — the picker
   * renders the dialog only.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ImageLibraryPicker({ trigger, onPick, open: openProp, onOpenChange }: ImageLibraryPickerProps) {
  const [openInternal, setOpenInternal] = useState(false)
  const open = openProp ?? openInternal
  const setOpen = (next: boolean) => {
    if (openProp === undefined) {
      setOpenInternal(next)
    }
    onOpenChange?.(next)
  }
  const [q, setQ] = useState('')
  const [images, setImages] = useState<AdminImageDto[] | null>(null)
  // When the operator clicks the upload affordance we close the
  // picker and hand control to `<UploadImageDialog>`. On successful
  // upload the picker's `onPick` runs with the new row so the caller
  // (editor / cover input / meta sidebar) reuses its existing
  // insertion path — no second round trip through the library list.
  const [uploadOpen, setUploadOpen] = useState(false)

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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {openProp === undefined ? (
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
        ) : null}
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>从图片库选择</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="按文件名 / 备注搜索"
              className="max-w-md"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setOpen(false)
                setUploadOpen(true)
              }}
            >
              <UploadIcon /> 上传图片
            </Button>
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
      <UploadImageDialog
        open={uploadOpen}
        kind={{ kind: 'generic' }}
        onClose={() => setUploadOpen(false)}
        onUploaded={(image) => {
          setUploadOpen(false)
          onPick(image)
        }}
      />
    </>
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
      <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 text-badge text-white opacity-0 transition group-hover:opacity-100">
        {image.width}×{image.height}
      </span>
    </button>
  )
}
