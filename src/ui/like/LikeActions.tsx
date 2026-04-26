import { useEffect, useReducer } from 'react'

import type {
  DecreaseLikeInput,
  DecreaseLikeOutput,
  IncreaseLikeInput,
  IncreaseLikeOutput,
  ValidateLikeTokenInput,
  ValidateLikeTokenOutput,
} from '@/client/api/action-types'
import type { IconName } from '@/ui/icons/Icon'

import config from '@/blog.config'
import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { joinUrl } from '@/shared/urls'
import { DynamicIcon, HeartFillIcon } from '@/ui/icons/icons'
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

export type LikeButtonAction =
  | { type: 'reset'; permalink: string; likes: number }
  | { type: 'validated'; permalink: string; valid: boolean }
  | { type: 'increaseOptimistic'; permalink: string }
  | { type: 'increaseConfirmed'; permalink: string; likes: number }
  | { type: 'decreaseOptimistic'; permalink: string }
  | { type: 'decreaseConfirmed'; permalink: string; likes: number }

export function createLikeButtonState(permalink: string, likes: number): LikeButtonState {
  return { permalink, likes, liked: false }
}

export function likeButtonReducer(state: LikeButtonState, action: LikeButtonAction): LikeButtonState {
  if (action.type === 'reset') {
    return createLikeButtonState(action.permalink, action.likes)
  }
  if (action.permalink !== state.permalink) {
    return state
  }

  switch (action.type) {
    case 'validated':
      return { ...state, liked: action.valid }
    case 'increaseOptimistic':
      return { ...state, liked: true, likes: state.likes + 1 }
    case 'increaseConfirmed':
      return { ...state, liked: true, likes: action.likes }
    case 'decreaseOptimistic':
      return { ...state, liked: false, likes: Math.max(0, state.likes - 1) }
    case 'decreaseConfirmed':
      return { ...state, liked: false, likes: action.likes }
  }
}

// React 19 client island: replaces the imperative
// `src/assets/scripts/features/like-button.ts` glue. The button hydrates on
// the post / page detail pages, validates any cached like token in
// `localStorage`, and uses one `useApiFetcher` per direction so the SSR
// HTML (count / heart) stays the source of truth on first paint.
export function LikeButton({ permalink, likes: initialLikes }: LikeButtonProps) {
  const [state, dispatch] = useReducer(likeButtonReducer, createLikeButtonState(permalink, initialLikes))

  const validate = useApiFetcher<ValidateLikeTokenInput, ValidateLikeTokenOutput>(
    API_ACTIONS.comment.validateLikeToken,
    {
      onSuccess: (data) => {
        dispatch({ type: 'validated', permalink: data.key, valid: data.valid })
        if (!data.valid) localStorage.removeItem(tokenStorageKey(data.key))
      },
    },
  )

  const increase = useApiFetcher<IncreaseLikeInput, IncreaseLikeOutput>(API_ACTIONS.comment.increaseLike, {
    onSuccess: (data) => {
      dispatch({ type: 'increaseConfirmed', permalink: data.key, likes: data.likes })
      localStorage.setItem(tokenStorageKey(data.key), data.token)
    },
  })

  const decrease = useApiFetcher<DecreaseLikeInput, DecreaseLikeOutput>(API_ACTIONS.comment.decreaseLike, {
    onSuccess: (data) => {
      dispatch({ type: 'decreaseConfirmed', permalink: data.key, likes: data.likes })
      localStorage.removeItem(tokenStorageKey(data.key))
    },
  })

  // Sync local island state to React Router loader data. Detail routes reuse
  // the same component instance when navigating `/posts/a` -> `/posts/b`, so
  // both the counter and local "liked" flag must be reset before validating
  // the new page's cached token.
  const validateSubmit = validate.submit
  useEffect(() => {
    dispatch({ type: 'reset', permalink, likes: initialLikes })
    const token = localStorage.getItem(tokenStorageKey(permalink))
    if (!token) return
    validateSubmit({ key: permalink, token })
  }, [permalink, initialLikes, validateSubmit])

  const isPending = increase.isPending || decrease.isPending

  const onClick = () => {
    if (isPending) return

    if (state.liked) {
      const token = localStorage.getItem(tokenStorageKey(permalink))
      if (!token) return
      dispatch({ type: 'decreaseOptimistic', permalink })
      decrease.submit({ key: permalink, token })
    } else {
      dispatch({ type: 'increaseOptimistic', permalink })
      increase.submit({ key: permalink })
    }
  }

  const className = `post-like btn btn-secondary btn-lg btn-rounded${state.liked ? ' current' : ''}${isPending ? ' lock' : ''}`

  return (
    <div className="post-action text-center mt-5">
      <button
        className={className}
        title="Do you like me?"
        type="button"
        data-permalink={permalink}
        onClick={onClick}
        disabled={isPending}
      >
        <HeartFillIcon className="me-1" />
        <span className="like-count">{state.likes}</span>
      </button>
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
  const postURL = joinUrl(config.website, post.permalink)
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
    <div className="post-share text-center mt-4">
      <SocialIconLink
        href={`https://connect.qq.com/widget/shareqq/index.html?${qq}`}
        title="分享到 QQ 空间"
        icon="qq"
        className="btn btn-light btn-icon btn-md btn-circle mx-1 qq"
      />
      <QRDialog
        url={postURL}
        name="在微信中请长按二维码"
        title="微信扫一扫 分享朋友圈"
        icon="wechat"
        className="btn btn-light btn-icon btn-circle btn-md single-popup mx-1"
      />
      <SocialIconLink
        href={`https://service.weibo.com/share/share.php?${weibo}`}
        title="分享到微博"
        icon="weibo"
        className="btn btn-light btn-icon btn-circle btn-md mx-1 weibo"
      />
    </div>
  )
}

// Each external share button collapses to <a><span><Icon /></span></a> with
// the exact same shape; the QR variant uses its own dialog so we don't
// generalize that one. Extracted to keep `LikeShare` declarative.
interface SocialIconLinkProps {
  href: string
  title: string
  icon: IconName
  className: string
}

function SocialIconLink({ href, title, icon, className }: SocialIconLinkProps) {
  return (
    <a href={href} className={className} title={title}>
      <span>
        <DynamicIcon name={icon} />
      </span>
    </a>
  )
}
