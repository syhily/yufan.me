import type { NavigateFunction } from 'react-router'

import { ArrowLeftIcon, AlertTriangleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import type { AdminPageDetailDto, GetPageInput } from '@/shared/cms-pages'

import { API_ACTIONS, useAdminMutation } from '@/client/api/fetcher'
import { PageEditorShell } from '@/ui/admin/pages/PageEditorShell'
import { Button } from '@/ui/components/button'
import { Skeleton } from '@/ui/components/skeleton'

const GET_PAGE = API_ACTIONS.admin.getPage

export interface PageEditorRouteProps {
  pageId: string
  navigate: NavigateFunction
}

// Top-level wrapper around `PageEditorShell` that owns the
// "fetch the detail DTO from the API on mount" lifecycle. Kept
// separate from the shell so the shell stays plain-props +
// straightforward to unit-test.
export function PageEditorRoute({ pageId, navigate }: PageEditorRouteProps) {
  const [detail, setDetail] = useState<AdminPageDetailDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const getPageApi = useAdminMutation<GetPageInput, AdminPageDetailDto>(GET_PAGE, {
    onSuccess: (payload) => {
      setDetail(payload)
      setErrorMessage(null)
    },
    onError: (error) => {
      setErrorMessage(error.message)
      return true
    },
  })
  const { load } = getPageApi

  useEffect(() => {
    load({ id: pageId })
  }, [load, pageId])

  if (errorMessage !== null) {
    return <PageEditorError message={errorMessage} />
  }
  if (detail === null) {
    return <PageEditorSkeleton />
  }
  return <PageEditorShell mode="edit" detail={detail} navigate={navigate} />
}

function PageEditorError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangleIcon className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold">无法打开页面编辑器</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        render={
          <Link to="/wp-admin/pages">
            <ArrowLeftIcon /> 返回列表
          </Link>
        }
      />
    </div>
  )
}

function PageEditorSkeleton() {
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
