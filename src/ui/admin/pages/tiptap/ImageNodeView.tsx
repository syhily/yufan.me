import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ImageOffIcon, LinkIcon, RotateCcwIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'

import { ImageLibraryPicker } from '@/ui/admin/pages/ImageLibraryPicker'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { cn } from '@/ui/lib/cn'

// React NodeView for the image block. Replaces the bare `<img>` that
// Tiptap's default Image extension renders so the operator can edit
// alt + caption inline (matching the public renderer's `<figcaption>`)
// and swap the bytes via the existing image library picker.
//
// **State strategy**: alt + caption are double-bound (state ↔ node
// attrs). Local state keeps the inputs responsive while the user
// types; on every change we push back through `updateAttributes` so
// the canonical PT body in the editor reducer stays in sync. There's
// no save button on the inputs themselves — the autosave loop in the
// outer shell flushes the whole body on idle.

export function ImageNodeView(props: NodeViewProps) {
  const attrs = props.node.attrs as {
    src?: string
    alt?: string
    caption?: string
    width?: number
    height?: number
    storagePath?: string
    thumbhash?: string
    imageId?: string
  }
  const [alt, setAlt] = useState(attrs.alt ?? '')
  const [caption, setCaption] = useState(attrs.caption ?? '')
  const [externalUrl, setExternalUrl] = useState(
    attrs.imageId === undefined && attrs.src !== undefined ? attrs.src : '',
  )
  const [showExternalForm, setShowExternalForm] = useState(false)
  const isLibrary = attrs.imageId !== undefined && attrs.imageId !== ''

  const commitAlt = (value: string) => {
    setAlt(value)
    props.updateAttributes({ alt: value })
  }
  const commitCaption = (value: string) => {
    setCaption(value)
    props.updateAttributes({ caption: value })
  }
  const commitExternalUrl = (value: string) => {
    props.updateAttributes({
      src: value,
      imageId: undefined,
      storagePath: undefined,
      thumbhash: undefined,
      width: undefined,
      height: undefined,
    })
  }

  return (
    <NodeViewWrapper
      data-image-node-view
      className={cn(
        'group relative my-3 flex flex-col gap-2 rounded-md border-2 border-dashed bg-muted/20 p-3',
        props.selected ? 'border-primary' : 'border-border',
      )}
      contentEditable={false}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <ImageLibraryPicker
          trigger={
            <Button variant="secondary" size="icon" type="button" title="从媒体库选择" aria-label="从媒体库选择">
              <RotateCcwIcon />
            </Button>
          }
          onPick={(image) =>
            props.updateAttributes({
              src: image.publicUrl,
              alt: image.note ?? alt,
              width: image.width,
              height: image.height,
              thumbhash: image.thumbhash ?? undefined,
              storagePath: image.storagePath,
              imageId: image.id,
            })
          }
        />
        <Button
          variant="secondary"
          size="icon"
          type="button"
          title="使用外部链接"
          aria-label="使用外部链接"
          aria-pressed={showExternalForm}
          onClick={() => setShowExternalForm((v) => !v)}
        >
          <LinkIcon />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          type="button"
          title="删除图片块"
          aria-label="删除图片块"
          onClick={() => props.deleteNode()}
        >
          <TrashIcon />
        </Button>
      </div>

      {attrs.src !== undefined && attrs.src !== '' ? (
        <div className="relative">
          <img
            src={attrs.src}
            alt={alt}
            width={attrs.width}
            height={attrs.height}
            className="mx-auto max-h-72 w-auto rounded object-contain"
            draggable={false}
          />
          <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {isLibrary ? '媒体库' : '外链'}
          </span>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <ImageOffIcon /> 尚未选择图片
        </div>
      )}

      {showExternalForm ? (
        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor={`img-${props.getPos()}-ext`}>
            外部图片链接（不会写入媒体库）
          </Label>
          <div className="flex gap-2">
            <Input
              id={`img-${props.getPos()}-ext`}
              value={externalUrl}
              placeholder="https://example.com/image.jpg"
              onChange={(event) => setExternalUrl(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                commitExternalUrl(externalUrl.trim())
                setShowExternalForm(false)
              }}
              disabled={externalUrl.trim() === ''}
            >
              使用
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label className="text-xs" htmlFor={`img-${props.getPos()}-alt`}>
          替代文本（alt）
        </Label>
        <Input
          id={`img-${props.getPos()}-alt`}
          value={alt}
          placeholder="无障碍说明，搜索引擎也会读取"
          onChange={(event) => commitAlt(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs" htmlFor={`img-${props.getPos()}-caption`}>
          图说（caption）
        </Label>
        <Input
          id={`img-${props.getPos()}-caption`}
          value={caption}
          placeholder="可选，渲染为 <figcaption>"
          onChange={(event) => commitCaption(event.target.value)}
        />
      </div>
    </NodeViewWrapper>
  )
}
