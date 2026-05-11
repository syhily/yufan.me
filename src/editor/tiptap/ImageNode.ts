import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ImageNodeView } from '@/editor/tiptap/ImageNodeView'

// PortableText `image` blocks carry richer metadata than the default
// Tiptap image node: a caption, intrinsic width/height (so the viewer
// reserves layout space and avoids CLS), an optional thumbhash for the
// blurred placeholder, and the S3 storage path used by the admin
// library to know the canonical asset for delete/duplicate flows.
//
// Extending `@tiptap/extension-image` keeps the toolbar / drag-and-drop
// behaviour the upstream extension provides and only adds attributes;
// the bridge already projects them in/out of `attrs` round-trippably.
//
// The React NodeView (`ImageNodeView`) replaces the bare `<img>` in
// the editor canvas so the operator can edit alt + caption inline
// and swap the bytes via the existing image library picker.
export const ImageNode = Image.extend({
  draggable: true,
  addAttributes() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      _key: { default: '' },
      caption: { default: undefined },
      width: {
        default: undefined,
        parseHTML(element) {
          const value = element.getAttribute('width')
          if (value === null) {
            return undefined
          }
          const parsed = Number.parseInt(value, 10)
          return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
        },
        renderHTML(attrs) {
          return attrs.width === undefined ? {} : { width: attrs.width }
        },
      },
      height: {
        default: undefined,
        parseHTML(element) {
          const value = element.getAttribute('height')
          if (value === null) {
            return undefined
          }
          const parsed = Number.parseInt(value, 10)
          return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
        },
        renderHTML(attrs) {
          return attrs.height === undefined ? {} : { height: attrs.height }
        },
      },
      thumbhash: { default: undefined },
      storagePath: { default: undefined },
      imageId: { default: undefined },
      layout: { default: undefined },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView, {
      // `ProseMirror-selectednode` is applied to this outer shell — not
      // `NodeViewWrapper`. Pin readable ink + input chrome here so prose /
      // selection cascades cannot wash fields out to white-on-light.
      className:
        '!text-ink-body [&_[data-slot=input]]:!bg-background [&_[data-slot=input]]:!text-ink-body [&_[data-slot=input]]:!caret-ink-body',
    })
  },
})
