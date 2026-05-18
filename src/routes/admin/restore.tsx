import { useState } from 'react'
import { useLoaderData } from 'react-router'

import { orpcQuery, useMutation } from '@/client/api/query'
import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { listPagesForAdmin } from '@/server/domains/pages/service'
import { listPostsForAdmin } from '@/server/domains/posts/service'
import { Button } from '@/ui/components/button'
import { Card, CardContent } from '@/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs'

import type { Route } from './+types/restore'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'author')

  const [postsResult, pagesResult] = await Promise.all([
    listPostsForAdmin({ deletedStatus: 'deleted', limit: 100 }, { userId: ctx.user.id, role: ctx.role }),
    listPagesForAdmin({ deletedStatus: 'deleted', limit: 100 }),
  ])

  return { posts: postsResult.posts, pages: pagesResult.pages }
}

export default function RestorePage() {
  const { posts, pages } = useLoaderData<typeof loader>()
  const [activePosts, setActivePosts] = useState(posts)
  const [activePages, setActivePages] = useState(pages)
  const [tab, setTab] = useState<'posts' | 'pages'>('posts')

  const restorePostMutation = useMutation(orpcQuery.admin.posts.restore.mutationOptions())
  const restorePageMutation = useMutation(orpcQuery.admin.pages.restore.mutationOptions())

  const handleRestorePost = async (id: string) => {
    await restorePostMutation.mutateAsync({ id })
    setActivePosts((prev) => prev.filter((p) => p.id !== id))
  }

  const handleRestorePage = async (id: string) => {
    await restorePageMutation.mutateAsync({ id })
    setActivePages((prev) => prev.filter((p) => p.id !== id))
  }

  const empty = activePosts.length === 0 && activePages.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">回收站</h1>
        <p className="text-sm text-muted-foreground">恢复已删除的文章和页面</p>
      </div>

      {empty ? (
        <Card className="py-12">
          <CardContent className="text-center text-sm text-muted-foreground">回收站为空</CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'posts' | 'pages')}>
          <TabsList className="h-8">
            <TabsTrigger value="posts" className="text-xs">
              文章 ({activePosts.length})
            </TabsTrigger>
            <TabsTrigger value="pages" className="text-xs">
              页面 ({activePages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-3">
            <div className="flex flex-col gap-2">
              {activePosts.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-sm text-muted-foreground">没有已删除的文章</CardContent>
                </Card>
              ) : (
                activePosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-md border bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{post.title}</span>
                      <span className="text-xs text-muted-foreground">/posts/{post.slug}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleRestorePost(post.id)
                      }}
                      disabled={restorePostMutation.isPending}
                    >
                      恢复
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="pages" className="mt-3">
            <div className="flex flex-col gap-2">
              {activePages.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-sm text-muted-foreground">没有已删除的页面</CardContent>
                </Card>
              ) : (
                activePages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between rounded-md border bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{page.title}</span>
                      <span className="text-xs text-muted-foreground">/{page.slug}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleRestorePage(page.id)
                      }}
                      disabled={restorePageMutation.isPending}
                    >
                      恢复
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
