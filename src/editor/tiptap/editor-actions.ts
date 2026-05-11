import { Extension } from '@tiptap/core'

export interface EditorActions {
  openImagePicker?: () => void
  openMusicPicker?: () => void
  openFootnoteDialog?: () => void
}

declare module '@tiptap/core' {
  interface Storage {
    editorActions: EditorActions
  }
}

export const EditorActionsExtension = Extension.create<unknown, EditorActions>({
  name: 'editorActions',
  addStorage(): EditorActions {
    return {}
  },
})
