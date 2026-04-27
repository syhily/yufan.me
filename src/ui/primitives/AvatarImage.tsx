import type { Ref } from 'react'

import { cn } from '@/ui/lib/cn'
import { Avatar } from '@/ui/primitives/Avatar'

// Avatar image with a default-avatar background fallback so the rounded
// frame stays painted even before the remote `<img>` resolves. Replaces
// the 17-line inline `style={{ backgroundImage: …, backgroundSize: …,
// backgroundPosition: … }}` chain that used to repeat across
// `CommentItem` and `CommentReplyForm`.
//
// Sizing follows the existing Comments-island contract: the host opts in
// to a `data-size` attribute, and the matching `[data-size="…"]` rules in
// `commentsTokens.css` resolve to `--comment-avatar-base` (28 px),
// `--comment-avatar-md` (40 px) on `md+`, and `--comment-avatar-nested`
// (30 px) inside `ul[data-nested]`. The `<AvatarImage>` JSX therefore
// owns no width/height utilities of its own — sizing flows from CSS so
// nested-vs-top-level switches stay a single CSS rule, not a JSX
// boolean.
export interface AvatarImageProps {
  src: string
  alt: string
  /** Default-avatar fallback painted under the remote `<img>`. */
  fallback?: string
  /** Rendered as `data-size`; consumed by `commentsTokens.css`. */
  size?: 'sm' | 'md'
  /** Caller spacing (e.g. `mr-2.5 md:mr-[0.9375rem]`). */
  className?: string
  ref?: Ref<HTMLDivElement>
}

const DEFAULT_AVATAR = '/images/default-avatar.png'

export function AvatarImage({ src, alt, fallback = DEFAULT_AVATAR, size = 'md', className, ref }: AvatarImageProps) {
  return (
    <Avatar
      ref={ref}
      data-size={size}
      className={cn('flex-avatar', className)}
      style={{
        backgroundImage: `url('${fallback}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <img alt={alt} src={src} loading="lazy" decoding="async" width={40} height={40} />
    </Avatar>
  )
}
