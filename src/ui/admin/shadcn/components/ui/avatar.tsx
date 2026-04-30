import type { ComponentProps } from 'react'

import { Avatar as BaseAvatar } from '@base-ui/react/avatar'

import { cn } from '@/ui/admin/shadcn/lib/utils'

function Avatar({ className, ...props }: ComponentProps<typeof BaseAvatar.Root>) {
  return (
    <BaseAvatar.Root
      data-slot="avatar"
      className={cn('tw:relative tw:flex tw:size-8 tw:shrink-0 tw:overflow-hidden tw:rounded-full', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: ComponentProps<typeof BaseAvatar.Image>) {
  return (
    <BaseAvatar.Image data-slot="avatar-image" className={cn('tw:aspect-square tw:size-full', className)} {...props} />
  )
}

function AvatarFallback({ className, ...props }: ComponentProps<typeof BaseAvatar.Fallback>) {
  return (
    <BaseAvatar.Fallback
      data-slot="avatar-fallback"
      className={cn('tw:bg-muted tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }
