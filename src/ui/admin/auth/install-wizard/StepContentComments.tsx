import type { StepProps } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export function StepContentComments(_props: StepProps) {
  const { data, updateData } = useInstallWizard()

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-sm font-semibold">内容分页</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-p-posts">首页分页数</Label>
          <Input
            id="w-p-posts"
            type="number"
            value={data.content.pagination.posts}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: {
                  ...prev.content,
                  pagination: { ...prev.content.pagination, posts: Number(e.target.value) },
                },
              }))
            }
            min={1}
            max={100}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-p-cat">分类分页数</Label>
          <Input
            id="w-p-cat"
            type="number"
            value={data.content.pagination.category}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: {
                  ...prev.content,
                  pagination: { ...prev.content.pagination, category: Number(e.target.value) },
                },
              }))
            }
            min={1}
            max={100}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-p-tags">标签分页数</Label>
          <Input
            id="w-p-tags"
            type="number"
            value={data.content.pagination.tags}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: {
                  ...prev.content,
                  pagination: { ...prev.content.pagination, tags: Number(e.target.value) },
                },
              }))
            }
            min={1}
            max={100}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-p-search">搜索分页数</Label>
          <Input
            id="w-p-search"
            type="number"
            value={data.content.pagination.search}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: {
                  ...prev.content,
                  pagination: { ...prev.content.pagination, search: Number(e.target.value) },
                },
              }))
            }
            min={1}
            max={100}
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold">RSS / Feed</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-feed-size">RSS 条数</Label>
          <Input
            id="w-feed-size"
            type="number"
            value={data.content.feed.size}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: { ...prev.content, feed: { ...prev.content.feed, size: Number(e.target.value) } },
              }))
            }
            min={1}
            max={100}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="w-feed-full"
            checked={data.content.feed.full}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                content: { ...prev.content, feed: { ...prev.content.feed, full: e.target.checked } },
              }))
            }
            className="h-4 w-4"
          />
          <Label htmlFor="w-feed-full" className="cursor-pointer">
            RSS 输出全文
          </Label>
        </div>
      </div>

      <h3 className="text-sm font-semibold">评论</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-c-size">每页条数</Label>
          <Input
            id="w-c-size"
            type="number"
            value={data.comments.size}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                comments: { ...prev.comments, size: Number(e.target.value) },
              }))
            }
            min={1}
            max={100}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-c-token">Token 有效期（秒）</Label>
          <Input
            id="w-c-token"
            type="number"
            value={data.comments.tokenTtlSeconds}
            onChange={(e) =>
              updateData((prev) => ({
                ...prev,
                comments: { ...prev.comments, tokenTtlSeconds: Number(e.target.value) },
              }))
            }
            min={60}
            max={86400}
          />
        </div>
      </div>
    </div>
  )
}
