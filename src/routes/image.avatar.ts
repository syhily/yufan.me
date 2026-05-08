import { AvatarStatus, cacheAvatar, loadAvatar } from '@/server/cache/avatar'
import {
  defaultAvatarUrl,
  fetchAvatarImage,
  fetchQQAvatarImage,
  isQQEmail,
  resolveAvatarInfo,
} from '@/server/images/avatar-fetch'
import { pngResponse } from '@/server/route-helpers/http'

import type { Route } from './+types/image.avatar'

const PNG_HEADERS: HeadersInit = {
  'Cache-Control': 'public, max-age=604800',
}

export function headers() {
  return PNG_HEADERS
}

// Route orchestration only — the gravatar fetch logic, redirect handling
// and id-to-hash translation live in `@/server/images/avatar-fetch`.
export async function loader({ params }: Route.LoaderArgs) {
  const { hash } = params
  if (!hash) {
    return Response.redirect(defaultAvatarUrl())
  }

  const { email, hash: canonical } = await resolveAvatarInfo(hash)
  if (canonical === null) {
    await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return Response.redirect(defaultAvatarUrl())
  }

  // QQ email fast-path: fetch from Tencent CDN, compress, and cache using
  // the same pipeline as gravatar so every avatar is served as a local PNG.
  if (email && isQQEmail(email)) {
    const buffer = await fetchQQAvatarImage(email)
    if (buffer === null) {
      await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
      return Response.redirect(defaultAvatarUrl())
    }
    await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
    return pngResponse(buffer, PNG_HEADERS)
  }

  const avatar = await loadAvatar(canonical)
  if (avatar !== null) {
    if (avatar.status === AvatarStatus.NO_AVATAR) {
      return Response.redirect(defaultAvatarUrl())
    }
    if (avatar.buffer !== null) {
      return pngResponse(avatar.buffer, PNG_HEADERS)
    }
  }

  const buffer = await fetchAvatarImage(canonical)
  if (buffer === null) {
    await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
    return Response.redirect(defaultAvatarUrl())
  }

  await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
  return pngResponse(buffer, PNG_HEADERS)
}
