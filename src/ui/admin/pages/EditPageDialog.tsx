import { SaveIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AdminPageDto, UpsertPageMetaInput, UpsertPageMetaOutput } from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

const UPSERT = API_ACTIONS.admin.upsertPageMeta

// Same discriminator pattern as EditCategoryDialog: `page === null`
// opens the dialog in "create new page" mode; a populated `page`
// opens it in "edit existing" mode. The body editor is reached
// separately via the row's "编辑内容" button — this dialog only
// covers metadata.
export interface EditPageDialogProps {
  page: AdminPageDto | null | undefined
  onClose: () => void
  onSaved: (page: AdminPageDto) => void
}

interface DraftState {
  slug: string
  title: string
  summary: string
  cover: string
  og: string
  published: boolean
  commentsEnabled: boolean
  showToc: boolean
}

const EMPTY_DRAFT: DraftState = {
  slug: '',
  title: '',
  summary: '',
  cover: '',
  og: '',
  published: true,
  commentsEnabled: true,
  showToc: false,
}

function draftFromPage(page: AdminPageDto): DraftState {
  return {
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    cover: page.cover,
    og: page.og ?? '',
    published: page.published,
    commentsEnabled: page.commentsEnabled,
    showToc: page.showToc,
  }
}

export function EditPageDialog({ page, onClose, onSaved }: EditPageDialogProps) {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const upsertApi = useApiFetcher<UpsertPageMetaInput, UpsertPageMetaOutput>(UPSERT, {
    onSuccess: (payload) => {
      setErrorMessage(null)
      onSaved(payload.page)
    },
    onError: (error) => setErrorMessage(error.message),
  })
  const { submit, isPending } = upsertApi

  useEffect(() => {
    if (page === undefined) {
      return
    }
    setErrorMessage(null)
    setDraft(page === null ? EMPTY_DRAFT : draftFromPage(page))
  }, [page])

  const open = page !== undefined
  const isEditing = page !== null && page !== undefined

  function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault()
    submit({
      id: isEditing ? page!.id : undefined,
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      cover: draft.cover.trim(),
      og: draft.og.trim() === '' ? null : draft.og.trim(),
      published: draft.published,
      commentsEnabled: draft.commentsEnabled,
      showToc: draft.showToc,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑页面信息' : '新建页面'}</DialogTitle>
          <DialogDescription>页面的元数据。正文请通过列表中的「编辑内容」按钮进入富文本编辑器。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="page-slug">URL slug</Label>
            <Input
              id="page-slug"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="about"
              required
              maxLength={80}
            />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="page-title">标题</Label>
            <Input
              id="page-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="关于我"
              required
              maxLength={200}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="page-summary">摘要</Label>
            <Textarea
              id="page-summary"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="page-cover">封面图 URL</Label>
            <Input
              id="page-cover"
              value={draft.cover}
              onChange={(e) => setDraft({ ...draft, cover: e.target.value })}
              placeholder="https://…"
              maxLength={500}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="page-og">OG 图 URL（可选）</Label>
            <Input
              id="page-og"
              value={draft.og}
              onChange={(e) => setDraft({ ...draft, og: e.target.value })}
              placeholder="https://…"
              maxLength={500}
            />
          </div>
          <fieldset className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="page-published"
                checked={draft.published}
                onCheckedChange={(value) => setDraft({ ...draft, published: value === true })}
              />
              <label htmlFor="page-published" className="select-none">
                已发布
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="page-comments"
                checked={draft.commentsEnabled}
                onCheckedChange={(value) => setDraft({ ...draft, commentsEnabled: value === true })}
              />
              <label htmlFor="page-comments" className="select-none">
                开启评论
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="page-toc"
                checked={draft.showToc}
                onCheckedChange={(value) => setDraft({ ...draft, showToc: value === true })}
              />
              <label htmlFor="page-toc" className="select-none">
                显示目录
              </label>
            </div>
          </fieldset>
          {errorMessage !== null ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              <XIcon /> 取消
            </Button>
            <Button type="submit" disabled={isPending || draft.slug.trim() === '' || draft.title.trim() === ''}>
              <SaveIcon /> {isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
