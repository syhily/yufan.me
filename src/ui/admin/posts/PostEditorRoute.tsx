import type { NavigateFunction } from 'react-router'

import { ArrowLeftIcon, AlertTriangleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import type { AdminPostDetailDto } from '@/shared/cms-posts'

import { api } from '@/client/api/client'
import { useApiQuery } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'
import { PostEditorShell } from '@/ui/admin/posts/PostEditorShell'
import { Button } from '@/ui/components/button'
import { Skeleton } from '@/ui/components/skeleton'

export interface PostEditorRouteProps {
  postId: string
  navigate: NavigateFunction
}

export function PostEditorRoute({ postId, navigate }: PostEditorRouteProps) {
  const [detail, setDetail] = useState<AdminPostDetailDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const postQuery = useApiQuery<AdminPostDetailDto>(['admin', 'getPost', postId], () =>
    unwrap(api.admin.getPost({ params: { id: postId } })),
  )

  useEffect(() => {
    if (postQuery.data) {
      setDetail(postQuery.data)
      setErrorMessage(null)
    }
  }, [postQuery.data])

  useEffect(() => {
    if (postQuery.error) {
      setErrorMessage(postQuery.error.message)
    }
  }, [postQuery.error])

  if (errorMessage !== null) {
    return <PostEditorError message={errorMessage} />
  }
  if (postQuery.isPending || detail === null) {
    return <PostEditorSkeleton />
  }
  return <PostEditorShell mode="edit" detail={detail} navigate={navigate} />
}

function PostEditorError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangleIcon className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold">无法打开文章编辑器</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        render={
          <Link to="/wp-admin/posts">
            <ArrowLeftIcon /> 返回列表
          </Link>
        }
      />
    </div>
  )
}

function PostEditorSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid grow gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="min-h-[480px]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  )
}
