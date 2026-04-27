import type { ComponentPropsWithRef, Ref } from 'react'

import { cn } from '@/ui/lib/cn'

// Replaces `.flex-avatar` (legacy `_base.css`). The legacy CSS uses
// `border-radius: 50px` on the container and inherits radius on the inner
// `<img>`. Sizes (`avatar-30`, `avatar-40`, etc.) are passed through
// `className` by callers because they vary widely (28px, 30px, 36px,
// 40px, 50px, 80px). Default size is 40px to match the most common
// comment-author render.
export interface AvatarProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
}

export function Avatar({ className, children, ref, ...props }: AvatarProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center justify-center font-semibold leading-none whitespace-nowrap rounded-full overflow-hidden [&>img]:w-full [&>img]:rounded-[inherit]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
