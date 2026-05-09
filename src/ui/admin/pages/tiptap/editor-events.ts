// Editor → shell event bus. The slash menu (and any future affordance
// inside `<EditorContent>`) doesn't have a direct handle to the
// outer `<PageBodyEditor>` callbacks that own the image / music
// pickers, so the easiest decoupled wire-up is a tiny set of named
// `CustomEvent`s on `document`. The shell adds listeners on mount;
// the slash command merely dispatches.
//
// Why `document` and not the editor's own DOM root? The dispatcher
// lives inside Tiptap's React tree but the picker dialogs render
// through Portals attached to `document.body`, which means the
// natural bubbling root that all listeners can agree on IS `document`.
// We namespace event names so we don't collide with any future
// extension Tiptap may add.

export const EDITOR_EVENT_OPEN_IMAGE_PICKER = 'yufan:open-image-picker'
export const EDITOR_EVENT_OPEN_MUSIC_PICKER = 'yufan:open-music-picker'
export const EDITOR_EVENT_OPEN_FOOTNOTE_DIALOG = 'yufan:open-footnote-dialog'

export function dispatchOpenImagePicker(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.dispatchEvent(new CustomEvent(EDITOR_EVENT_OPEN_IMAGE_PICKER))
}

export function dispatchOpenMusicPicker(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.dispatchEvent(new CustomEvent(EDITOR_EVENT_OPEN_MUSIC_PICKER))
}

export function dispatchOpenFootnoteDialog(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.dispatchEvent(new CustomEvent(EDITOR_EVENT_OPEN_FOOTNOTE_DIALOG))
}
