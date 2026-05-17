import { useEffect, useState } from 'react'

import type { AdminCategoryDto } from '@/shared/types/categories'

import { orpcQuery, useQuery } from '@/client/api/query'
import { Label } from '@/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'

export interface CategoryFieldProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CategoryField({ value, onChange, disabled }: CategoryFieldProps) {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([])
  const categoriesQuery = useQuery(orpcQuery.admin.categories.list.queryOptions({ input: {} }))

  useEffect(() => {
    if (categoriesQuery.data) {
      setCategories(categoriesQuery.data.categories)
    }
  }, [categoriesQuery.data])

  return (
    <div className="grid gap-2">
      <Label htmlFor="post-category">分类</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? '')} disabled={disabled}>
        <SelectTrigger id="post-category" className="w-full">
          <SelectValue placeholder="— 无分类 —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— 无分类 —</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.name}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">选择文章所属分类。若列表为空，请先在分类管理中创建。</p>
    </div>
  )
}
