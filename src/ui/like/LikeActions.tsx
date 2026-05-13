import { HeartIcon } from 'lucide-react'
import { useEffect, useState, useOptimistic } from 'react'

import type {
  DecreaseLikeInput,
  DecreaseLikeOutput,
  IncreaseLikeInput,
  IncreaseLikeOutput,
  ValidateLikeTokenInput,
  ValidateLikeTokenOutput,
} from '@/shared/api-types'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { joinUrl } from '@/shared/urls'
import { Button } from '@/ui/components/button'
import { IconButtonContent } from '@/ui/components/icon-button-content'
import { QQIcon, WechatIcon, WeiboIcon } from '@/ui/icons/brand-social-icons'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { QRDialog } from '@/ui/primitives/QRDialog'

export interface LikeButtonProps {
  permalink: string
  likes: number
}

const tokenStorageKey = (permalink: string): string => permalink

export interface LikeButtonState {
  permalink: string
  likes: number
  liked: boolean
}

export function createLikeButtonState(permalink: string, likes: number): LikeButtonState {
  return { permalink, likes, liked: false }
}

/** Apply an optimistic like/unlike toggle. Exported for unit tests. */
export function applyLikeOptimistic(state: LikeButtonState, action: 'like' | 'unlike'): LikeButtonState {
  if (action === 'like') {
    return { ...state, liked: true, likes: state.likes + 1 }
  }
  return { ...state, liked: false, likes: Math.max(0, state.likes - 1) }
}

// React 19 client island: replaces the imperative
// `src/assets/scripts/features/like-button.ts` glue. The button hydrates on
// the post / page detail pages, validates any cached like token in
// `localStorage`, and uses one `useApiFetcher` per direction so the SSR
// HTML (count / heart) stays the source of truth on first paint.
export function LikeButton({ permalink, likes: initialLikes }: LikeButtonProps) {
  const [baseState, setBaseState] = useState(createLikeButtonState(permalink, initialLikes))
  const [state, addOptimistic] = useOptimistic(baseState, applyLikeOptimistic)

  const validate = useApiFetcher<ValidateLikeTokenInput, ValidateLikeTokenOutput>(
    API_ACTIONS.comment.validateLikeToken,
    {
      onSuccess: (data) => {
        setBaseState((prev) => (data.key === prev.permalink ? { ...prev, liked: data.valid } : prev))
        if (!data.valid) {
          localStorage.removeItem(tokenStorageKey(data.key))
        }
      },
    },
  )

  const increase = useApiFetcher<IncreaseLikeInput, IncreaseLikeOutput>(API_ACTIONS.comment.increaseLike, {
    onSuccess: (data) => {
      setBaseState((prev) => (data.key === prev.permalink ? { ...prev, liked: true, likes: data.likes } : prev))
      localStorage.setItem(tokenStorageKey(data.key), data.token)
    },
  })

  const decrease = useApiFetcher<DecreaseLikeInput, DecreaseLikeOutput>(API_ACTIONS.comment.decreaseLike, {
    onSuccess: (data) => {
      setBaseState((prev) => (data.key === prev.permalink ? { ...prev, liked: false, likes: data.likes } : prev))
      localStorage.removeItem(tokenStorageKey(data.key))
    },
  })

  // Sync local island state to React Router loader data. Detail routes reuse
  // the same component instance when navigating `/posts/a` -> `/posts/b`, so
  // both the counter and local "liked" flag must be reset before validating
  // the new page's cached token.
  const validateSubmit = validate.submit
  useEffect(() => {
    setBaseState(createLikeButtonState(permalink, initialLikes))
    const token = localStorage.getItem(tokenStorageKey(permalink))
    if (!token) {
      return
    }
    validateSubmit({ key: permalink, token })
  }, [permalink, initialLikes, validateSubmit])

  const isPending = increase.isPending || decrease.isPending

  const onClick = () => {
    if (isPending) {
      return
    }

    if (state.liked) {
      const token = localStorage.getItem(tokenStorageKey(permalink))
      if (!token) {
        return
      }
      addOptimistic('unlike')
      decrease.submit({ key: permalink, token })
    } else {
      addOptimistic('like')
      increase.submit({ key: permalink })
    }
  }

  return (
    <div className="mt-12 text-center">
      <Button
        variant="dark"
        size="lg"
        shape="pill"
        // - `px-10` widens the pill horizontally to match the
        //   legacy `padding-inline: 2.5rem` from the post-like rule.
        // - `data-[liked=true]:…` swaps the chrome to the red
        //   like-active state when the post is liked. The
        //   `[data-liked=true]` attribute selector adds 1 to
        //   selector specificity, so the data-state utilities
        //   win over the unconditional colourway by
        //   specificity at runtime.
        className={cn(
          'px-10',
          'hover:animate-shake hover:will-change-transform',
          'data-[liked=true]:border-like-active data-[liked=true]:bg-like-active data-[liked=true]:text-white data-[liked=true]:shadow-like-active',
          isPending && 'lock',
        )}
        title="Do you like me?"
        data-permalink={permalink}
        data-liked={state.liked ? 'true' : 'false'}
        onClick={onClick}
        disabled={isPending}
      >
        <HeartIcon
          className="icon-heart-fill me-1 mt-[-2px] size-[1.1em] align-middle"
          fill="currentColor"
          size="1em"
          strokeWidth={0}
          aria-hidden
        />
        <span className="inline-block align-middle">{state.likes}</span>
      </Button>
    </div>
  )
}

// Only the four fields the social-share intents need. Keeps the prop
// boundary loose so detail/listing projections don't have to widen here.
export interface LikeShareProps {
  post: {
    title: string
    summary: string
    cover: string
    permalink: string
  }
}

export function LikeShare({ post }: LikeShareProps) {
  const { website } = useSiteIdentity()
  const postURL = joinUrl(website, post.permalink)
  const qq = new URLSearchParams({
    url: postURL,
    pics: post.cover,
    summary: post.summary,
  }).toString()
  const weibo = new URLSearchParams({
    url: postURL,
    type: 'button',
    language: 'zh_cn',
    pic: post.cover,
    searchPic: 'true',
    title: `【${post.title}】${post.summary}`,
  }).toString()

  return (
    <div className="mt-6 text-center">
      <Button
        variant="light"
        size="iconMd"
        shape="circle"
        className="mx-1"
        // oxlint-disable-next-line jsx-a11y/anchor-has-content
        render={<a href={`https://connect.qq.com/widget/shareqq/index.html?${qq}`} />}
        title="分享到 QQ 空间"
      >
        <IconButtonContent>
          <QQIcon className="m-icon-inset" />
        </IconButtonContent>
      </Button>
      <QRDialog
        url={postURL}
        name="在微信中请长按二维码"
        title="微信扫一扫 分享朋友圈"
        trigger={<WechatIcon className="m-icon-inset" />}
        variant="light"
        size="iconMd"
        shape="circle"
        className="mx-1"
      />
      <Button
        variant="light"
        size="iconMd"
        shape="circle"
        className="mx-1"
        // oxlint-disable-next-line jsx-a11y/anchor-has-content
        render={<a href={`https://service.weibo.com/share/share.php?${weibo}`} />}
        title="分享到微博"
      >
        <IconButtonContent>
          <WeiboIcon className="m-icon-inset" />
        </IconButtonContent>
      </Button>
    </div>
  )
}
