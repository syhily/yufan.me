import type { Editor } from '@tiptap/core'

import { useCallback, useRef, useState } from 'react'

import { bodyToPmDoc, footnoteSyncSignature, pmDocToBody, type PmDoc } from '@/shared/pt/bridge'
import {
  extractFootnoteDefinitionBlocks,
  footnoteChildrenToPlainText,
  mergeProseBodyWithFootnoteDefinitions,
  plainTextToFootnoteChildren,
  stripFootnoteDefinitionsForEditor,
} from '@/shared/pt/footnote-merge'
import {
  generateBlockKey,
  validatePortableTextBody,
  type FootnoteDefinitionBlock,
  type PortableTextBody,
} from '@/shared/pt/schema'
import {
  canInsertFootnoteMark,
  computeNextFootnoteIndex,
  insertFootnoteReferenceAtCaret,
  removeFootnoteReferencesToTargetKey,
} from '@/ui/admin/editor/tiptap/insert-inline-footnote'

export interface FootnoteItem {
  _key: string
  index: number
  children: FootnoteDefinitionBlock['children']
}

export interface UseEditorFootnotesResult {
  /** Current footnote definitions extracted from the document. */
  footnotes: FootnoteDefinitionBlock[]
  /** Whether the footnote dialog is open. */
  dialogOpen: boolean
  /** Dialog mode — create vs edit. */
  dialogMode: 'create' | 'edit'
  /** Seed text when the dialog opens in edit mode. */
  dialogInitialText: string
  /** Key of the footnote currently being edited (null in create mode). */
  editTargetKey: string | null
  /** Open the dialog to insert a new footnote. */
  openInsertDialog: () => void
  /** Open the dialog to edit an existing footnote. */
  openEditDialog: (targetKey: string) => void
  /** Close or toggle the dialog. */
  setDialogOpen: (open: boolean) => void
  /** Insert (or update) a footnote and return the merged PT body. */
  insertFootnote: (plainText: string) => PortableTextBody | null
  /** Remove a footnote by target key and return the merged PT body. */
  removeFootnote: (targetKey: string) => PortableTextBody | null
  /** Reindex footnotes after an external change and return the merged PT body. */
  reindexFootnotes: () => PortableTextBody | null
  /** Process an editor update event, sync footnote state, and return the merged PT body. */
  handleEditorUpdate: (instance: Editor) => PortableTextBody
  /** Reset footnote state from an initial body (e.g. when bodyKey changes). */
  resetFootnotes: (body: PortableTextBody) => PortableTextBody
}

export function useEditorFootnotes(editor: Editor | null): UseEditorFootnotesResult {
  const [footnoteDefs, setFootnoteDefs] = useState<FootnoteDefinitionBlock[]>([])
  const footnoteDefsRef = useRef(footnoteDefs)
  footnoteDefsRef.current = footnoteDefs

  const editorFootnoteSigRef = useRef<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [dialogInitialText, setDialogInitialText] = useState('')
  const footnoteEditTargetKeyRef = useRef<string | null>(null)

  const openInsertDialog = useCallback(() => {
    footnoteEditTargetKeyRef.current = null
    setDialogMode('create')
    setDialogInitialText('')
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((targetKey: string) => {
    const def = footnoteDefsRef.current.find((d) => d._key === targetKey)
    footnoteEditTargetKeyRef.current = targetKey
    setDialogMode('edit')
    setDialogInitialText(def !== undefined ? footnoteChildrenToPlainText(def.children) : '')
    setDialogOpen(true)
  }, [])

  const handleEditorUpdate = useCallback((instance: Editor): PortableTextBody => {
    const merged = mergeProseBodyWithFootnoteDefinitions(
      pmDocToBody(instance.getJSON() as PmDoc),
      footnoteDefsRef.current,
    )
    const nextDefs = extractFootnoteDefinitionBlocks(merged)
    if (JSON.stringify(nextDefs) !== JSON.stringify(footnoteDefsRef.current)) {
      setFootnoteDefs(nextDefs)
      footnoteDefsRef.current = nextDefs
    }
    const fp = footnoteSyncSignature(merged)
    if (fp !== editorFootnoteSigRef.current) {
      editorFootnoteSigRef.current = fp
      instance.commands.setContent(bodyToPmDoc(stripFootnoteDefinitionsForEditor(merged)) as never, {
        emitUpdate: false,
      })
    }
    return merged
  }, [])

  const insertFootnote = useCallback(
    (plainText: string): PortableTextBody | null => {
      if (editor === null) {
        return null
      }
      const editKey = footnoteEditTargetKeyRef.current
      if (editKey !== null) {
        const nextDefs = footnoteDefsRef.current.map((d) =>
          d._key === editKey ? { ...d, children: plainTextToFootnoteChildren(plainText) } : d,
        )
        setFootnoteDefs(nextDefs)
        footnoteDefsRef.current = nextDefs
        footnoteEditTargetKeyRef.current = null
        const merged = mergeProseBodyWithFootnoteDefinitions(pmDocToBody(editor.getJSON() as PmDoc), nextDefs)
        return merged
      }
      if (!canInsertFootnoteMark(editor)) {
        return null
      }
      const nextIndex = computeNextFootnoteIndex(editor, footnoteDefsRef.current)
      const defKey = generateBlockKey()
      const refMarkKey = generateBlockKey()
      const newDef: FootnoteDefinitionBlock = {
        _type: 'footnoteDefinition',
        _key: defKey,
        index: nextIndex,
        children: plainTextToFootnoteChildren(plainText),
      }
      const nextDefs = [...footnoteDefsRef.current, newDef]
      setFootnoteDefs(nextDefs)
      footnoteDefsRef.current = nextDefs
      insertFootnoteReferenceAtCaret(editor, { defKey, refMarkKey, index: nextIndex })
      const merged = mergeProseBodyWithFootnoteDefinitions(pmDocToBody(editor.getJSON() as PmDoc), nextDefs)
      return merged
    },
    [editor],
  )

  const removeFootnote = useCallback(
    (targetKey: string): PortableTextBody | null => {
      if (editor === null) {
        return null
      }
      removeFootnoteReferencesToTargetKey(editor, targetKey)
      const nextDefs = footnoteDefsRef.current.filter((d) => d._key !== targetKey)

      const merged = mergeProseBodyWithFootnoteDefinitions(pmDocToBody(editor.getJSON() as PmDoc), nextDefs)
      const syncedDefs = extractFootnoteDefinitionBlocks(merged)
      setFootnoteDefs(syncedDefs)
      footnoteDefsRef.current = syncedDefs

      const fp = footnoteSyncSignature(merged)
      if (fp !== editorFootnoteSigRef.current) {
        editorFootnoteSigRef.current = fp
        editor.commands.setContent(bodyToPmDoc(stripFootnoteDefinitionsForEditor(merged)) as never, {
          emitUpdate: false,
        })
      }
      return merged
    },
    [editor],
  )

  const reindexFootnotes = useCallback((): PortableTextBody | null => {
    if (editor === null) {
      return null
    }
    const merged = mergeProseBodyWithFootnoteDefinitions(
      pmDocToBody(editor.getJSON() as PmDoc),
      footnoteDefsRef.current,
    )
    const fp = footnoteSyncSignature(merged)
    if (fp !== editorFootnoteSigRef.current) {
      editorFootnoteSigRef.current = fp
      editor.commands.setContent(bodyToPmDoc(stripFootnoteDefinitionsForEditor(merged)) as never, {
        emitUpdate: false,
      })
    }
    return merged
  }, [editor])

  const resetFootnotes = useCallback(
    (body: PortableTextBody): PortableTextBody => {
      const defs = extractFootnoteDefinitionBlocks(body)
      const mergedCanon = mergeProseBodyWithFootnoteDefinitions(stripFootnoteDefinitionsForEditor(body), defs)
      const syncedDefs = extractFootnoteDefinitionBlocks(mergedCanon)
      setFootnoteDefs(syncedDefs)
      footnoteDefsRef.current = syncedDefs
      editorFootnoteSigRef.current = footnoteSyncSignature(mergedCanon)
      if (editor) {
        editor.commands.setContent(bodyToPmDoc(stripFootnoteDefinitionsForEditor(mergedCanon)) as never, {
          emitUpdate: false,
        })
      }
      return mergedCanon
    },
    [editor],
  )

  return {
    footnotes: footnoteDefs,
    dialogOpen,
    dialogMode,
    dialogInitialText,
    editTargetKey: footnoteEditTargetKeyRef.current,
    openInsertDialog,
    openEditDialog,
    setDialogOpen,
    insertFootnote,
    removeFootnote,
    reindexFootnotes,
    handleEditorUpdate,
    resetFootnotes,
  }
}
