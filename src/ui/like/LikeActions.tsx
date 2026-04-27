import { clsx } from 'clsx'
import { startTransition, useEffect, useOptimistic, useReducer } from 'react'
import { twMerge } from 'tailwind-merge'

import type {
  DecreaseLikeInput,
  DecreaseLikeOutput,
  IncreaseLikeInput,
  IncreaseLikeOutput,
  ValidateLikeTokenInput,
  ValidateLikeTokenOutput,
} from '@/client/api/action-types'
import type { IconComponent } from '@/ui/icons/icons'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiAction } from '@/client/api/fetcher'
import { joinUrl } from '@/shared/urls'
import { HeartIcon, QqIcon, WechatIcon, WeiboIcon } from '@/ui/icons/icons'
import { buttonVariants } from '@/ui/primitives/Button'
import { QRDialog } from '@/ui/primitives/QRDialog'
import { useSiteConfig } from '@/ui/primitives/site-config'
import { toneAttrs } from '@/ui/primitives/tone'

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

// Committed (server-truth) state. Optimistic increase/decrease lives on a
// React 19 `useOptimistic` overlay so React owns the rollback / re-pin
// instead of a manual `…Optimistic` reducer case.
export type LikeButtonAction =
  | { type: 'reset'; permalink: string; likes: number }
  | { type: 'validated'; permalink: string; valid: boolean }
  | { type: 'increaseConfirmed'; permalink: string; likes: number }
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
    case 'increaseConfirmed':
      return { ...state, liked: true, likes: action.likes }
    case 'decreaseConfirmed':
      return { ...state, liked: false, likes: action.likes }
  }
}

// Overlay used by `useOptimistic`. The reducer runs synchronously inside a
// transition, then React unwinds it once the awaited mutation finishes (or
// errors), at which point the committed reducer state takes over.
type LikeOptimistic = 'increase' | 'decrease'

function applyOptimistic(state: LikeButtonState, op: LikeOptimistic): LikeButtonState {
  if (op === 'increase') {
    return { ...state, liked: true, likes: state.likes + 1 }
  }
  return { ...state, liked: false, likes: Math.max(0, state.likes - 1) }
}

// React 19 client island: replaces the imperative
// `src/assets/scripts/features/like-button.ts` glue. The button hydrates on
// the post / page detail pages, validates any cached like token in
// `localStorage`, and uses one `useApiAction` per direction so the SSR
// HTML (count / heart) stays the source of truth on first paint.
//
// Pending mutations are overlaid through React 19's `useOptimistic`, so the
// counter / heart flip immediately while the network round-trip resolves.
// React unwinds the overlay automatically when the awaited mutation
// completes or rejects, restoring the committed reducer state.
export function LikeButton({ permalink, likes: initialLikes }: LikeButtonProps) {
  const [state, dispatch] = useReducer(likeButtonReducer, createLikeButtonState(permalink, initialLikes))
  const [optimistic, addOptimistic] = useOptimistic<LikeButtonState, LikeOptimistic>(state, applyOptimistic)

  const validate = useApiAction<ValidateLikeTokenInput, ValidateLikeTokenOutput>(
    API_ACTIONS.comment.validateLikeToken,
    {
      onSuccess: (data) => {
        dispatch({ type: 'validated', permalink: data.key, valid: data.valid })
        if (!data.valid) {
          localStorage.removeItem(tokenStorageKey(data.key))
        }
      },
    },
  )

  const increase = useApiAction<IncreaseLikeInput, IncreaseLikeOutput>(API_ACTIONS.comment.increaseLike, {
    onSuccess: (data) => {
      dispatch({ type: 'increaseConfirmed', permalink: data.key, likes: data.likes })
      localStorage.setItem(tokenStorageKey(data.key), data.token)
    },
  })

  const decrease = useApiAction<DecreaseLikeInput, DecreaseLikeOutput>(API_ACTIONS.comment.decreaseLike, {
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
    if (!token) {
      return
    }
    void validateSubmit({ key: permalink, token })
  }, [permalink, initialLikes, validateSubmit])

  const isPending = increase.isPending || decrease.isPending

  const onClick = () => {
    if (isPending) {
      return
    }

    if (optimistic.liked) {
      const token = localStorage.getItem(tokenStorageKey(permalink))
      if (!token) {
        return
      }
      // `useOptimistic` overlays must be applied inside an async transition;
      // React holds the overlay in place until the transition's promise
      // settles. The committed reducer state then takes over once the
      // fetcher's `onSuccess` drains the response envelope.
      startTransition(async () => {
        addOptimistic('decrease')
        await decrease.submit({ key: permalink, token })
      })
    } else {
      startTransition(async () => {
        addOptimistic('increase')
        await increase.submit({ key: permalink })
      })
    }
  }

  // `data-liked` drives the "loved" surface entirely from CSS so we don't
  // need `!important` on the className side anymore. The Layer C tokens
  // `--color-liked` / `--color-liked-shadow` (declared in `globals.css`)
  // swap automatically in dark mode.
  const className = twMerge(
    clsx(
      buttonVariants({ tone: 'inverse', size: 'lg', shape: 'pill' }),
      'hover:animate-[shake_0.82s_cubic-bezier(0.36,0.07,0.19,0.97)_both] hover:translate-z-0',
      'data-[liked=true]:bg-liked data-[liked=true]:border-liked data-[liked=true]:text-surface',
      'data-[liked=true]:shadow-[0_5px_20px_0_var(--color-liked-shadow)]',
    ),
  )

  return (
    <div className="text-center mt-5">
      <button
        className={className}
        {...toneAttrs('inverse', 'solid')}
        data-liked={optimistic.liked}
        title="Do you like me?"
        type="button"
        data-permalink={permalink}
        onClick={onClick}
        disabled={isPending}
      >
        <HeartIcon className="me-1 w-[1.1em] h-[1.1em] -mt-0.5 align-middle" />
        <span className="inline-block align-middle">{optimistic.likes}</span>
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
  const { website } = useSiteConfig()
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

  const socialBtn = buttonVariants({ tone: 'neutral', size: 'md', shape: 'circle' })
  const socialAttrs = toneAttrs('neutral', 'solid')

  return (
    <div className="text-center mt-4">
      <SocialIconLink
        href={`https://connect.qq.com/widget/shareqq/index.html?${qq}`}
        title="分享到 QQ 空间"
        icon={QqIcon}
        className={twMerge(clsx(socialBtn, 'mx-1'))}
        toneAttrs={socialAttrs}
      />
      <QRDialog
        url={postURL}
        name="在微信中请长按二维码"
        title="微信扫一扫 分享朋友圈"
        icon={WechatIcon}
        className={twMerge(clsx(socialBtn, 'mx-1'))}
        triggerTone={socialAttrs}
      />
      <SocialIconLink
        href={`https://service.weibo.com/share/share.php?${weibo}`}
        title="分享到微博"
        icon={WeiboIcon}
        className={twMerge(clsx(socialBtn, 'mx-1'))}
        toneAttrs={socialAttrs}
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
  icon: IconComponent
  className: string
  toneAttrs: ReturnType<typeof toneAttrs>
}

function SocialIconLink({ href, title, icon: Icon, className, toneAttrs: dataToneAttrs }: SocialIconLinkProps) {
  return (
    <a href={href} className={className} title={title} {...dataToneAttrs}>
      <span>
        <Icon />
      </span>
    </a>
  )
}
