import type { Editor } from '@tiptap/core'

import { CheckIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

// Inline link editing form. Lives inside the BubbleMenu so the
// link href can be authored / edited / removed without leaving the
// editor selection. The previous `window.prompt`-based affordance
// was hostile to keyboard navigation and broke focus tracking on
// macOS Safari (the prompt dialog steals selection).
//
// `apply` writes a link mark over the *extended* mark range so
// editing a partial selection still updates the whole link span.
// `remove` does the equivalent unset, keeping the inline text
// intact.

export interface LinkPopoverProps {
  editor: Editor
  /** Called by the parent to dismiss the popover. */
  onClose: () => void
}

export function LinkPopover({ editor, onClose }: LinkPopoverProps) {
  const initial = (editor.getAttributes('link').href as string | undefined) ?? ''
  const [value, setValue] = useState<string>(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Focus the input when the popover mounts so keyboard users can
  // start typing immediately.
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const apply = () => {
    const href = value.trim()
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    onClose()
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  return (
    <div
      className="flex w-80 flex-col gap-2 rounded-md border bg-popover p-3 text-sm shadow-md"
      onMouseDown={(event) => {
        // Keep the editor selection alive; without this the button
        // mousedown would blur the editor before the chain runs and
        // the `setLink` call would lose its anchor.
        event.preventDefault()
      }}
    >
      <Label className="text-xs">链接 URL</Label>
      <Input
        ref={inputRef}
        type="url"
        inputMode="url"
        value={value}
        placeholder="https://"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            apply()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      />
      <div className="flex justify-end gap-1">
        {initial !== '' ? (
          <Button variant="ghost" size="sm" type="button" onClick={remove} title="移除链接">
            <Trash2Icon /> 移除
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" type="button" onClick={onClose} title="取消">
          <XIcon /> 取消
        </Button>
        <Button size="sm" type="button" onClick={apply} title="应用">
          <CheckIcon /> 应用
        </Button>
      </div>
    </div>
  )
}
