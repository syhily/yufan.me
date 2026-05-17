import { XIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { AdminTagDto } from '@/shared/types/tags'

import { orpcQuery, useQuery } from '@/client/api/query'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export interface TagsFieldProps {
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
}

export function TagsField({ values, onChange, disabled }: TagsFieldProps) {
  const [input, setInput] = useState('')
  const [tags, setTags] = useState<AdminTagDto[]>([])
  const tagsQuery = useQuery(orpcQuery.admin.tags.list.queryOptions({ input: { limit: 100 } }))

  useEffect(() => {
    if (tagsQuery.data) {
      setTags(tagsQuery.data.tags)
    }
  }, [tagsQuery.data])

  const addTag = useCallback(
    (raw: string) => {
      const name = raw.trim()
      if (name === '' || values.includes(name)) {
        return
      }
      onChange([...values, name])
      setInput('')
    },
    [values, onChange],
  )

  const removeTag = useCallback(
    (name: string) => {
      onChange(values.filter((v) => v !== name))
    },
    [values, onChange],
  )

  const knownTagNames = new Set(tags.map((t) => t.name))
  const unknownTags = values.filter((v) => !knownTagNames.has(v))

  return (
    <div className="grid gap-2">
      <Label>标签</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
              aria-label={`移除标签 ${tag}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(input)
            }
          }}
          disabled={disabled}
          placeholder="输入标签名称，按回车添加"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addTag(input)}
          disabled={disabled || input.trim() === ''}
        >
          添加
        </Button>
      </div>
      {unknownTags.length > 0 && (
        <p className="text-xs text-status-warn-fg">
          警告：以下标签尚未在系统中创建：{unknownTags.join('、')}。保存前请确认，或前往标签管理新建。
        </p>
      )}
    </div>
  )
}
