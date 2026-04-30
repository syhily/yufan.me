import { Buffer } from 'node:buffer'

import { AvatarStatus, cacheAvatar, loadAvatar } from '@/server/cache/avatar'
import { findEmailById } from '@/server/db/query/user'
import { compressImage } from '@/server/images/compress'
import { pngResponse } from '@/server/route-helpers/http'
import config from '@/server/settings/config'
import { encodedEmail } from '@/shared/security'
import { isNumeric } from '@/shared/tools'
import { joinUrl } from '@/shared/urls'

import type { Route } from './+types/image.avatar'

const PNG_HEADERS: HeadersInit = {
  'Cache-Control': 'public, max-age=604800',
}

export function headers() {
  return PNG_HEADERS
}

function defaultAvatar(): string {
  return joinUrl(config.website, '/images/default-avatar.png')
}

// Some Gravatar mirrors answer with a 302 to a sized / CDN variant rather than
// streaming the bytes inline. We therefore inspect the first response with
// `redirect: "manual"`: if the mirror is bouncing us back to the default
// avatar URL we passed via `d=`, treat it as "no avatar"; otherwise follow
// the redirect chain ourselves so the cached payload is the real image rather
// than the empty 302 body.
const MAX_REDIRECT_HOPS = 5

async function avatarImage(hash: string): Promise<Buffer | null> {
  const defaultAvatarLink = defaultAvatar()
  const initialLink = joinUrl(
    config.settings.comments.avatar.mirror,
    `${hash}?s=${config.settings.comments.avatar.size}&d=${encodeURIComponent(defaultAvatarLink)}`,
  )
  const headers: Record<string, string> = {
    Accept: 'image/png',
    Referer: config.website,
  }

  let currentLink = initialLink
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const resp = await fetch(currentLink, { redirect: 'manual', headers })

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location')
      if (location === null) {
        return null
      }
      const nextLink = new URL(location, currentLink).toString()
      if (nextLink === defaultAvatarLink) {
        return null
      }
      currentLink = nextLink
      continue
    }

    if (resp.status > 299) {
      return null
    }

    return compressImage(Buffer.from(await resp.arrayBuffer()))
  }

  return null
}

async function resolveCanonicalKey(rawHash: string): Promise<string | null> {
  if (isNumeric(rawHash)) {
    const email = await findEmailById(BigInt(rawHash))
    return email === null ? null : encodedEmail(email)
  }
  return rawHash
}

export async function loader({ params }: Route.LoaderArgs) {
  const { hash } = params
  if (!hash) {
    return Response.redirect(defaultAvatar())
  }

  const canonical = await resolveCanonicalKey(hash)
  if (canonical === null) {
    await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return Response.redirect(defaultAvatar())
  }

  const avatar = await loadAvatar(canonical)
  if (avatar !== null) {
    if (avatar.status === AvatarStatus.NO_AVATAR) {
      return Response.redirect(defaultAvatar())
    }
    if (avatar.buffer !== null) {
      return pngResponse(avatar.buffer, PNG_HEADERS)
    }
  }

  const buffer = await avatarImage(canonical)
  if (buffer === null) {
    await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
    return Response.redirect(defaultAvatar())
  }

  await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
  return pngResponse(buffer, PNG_HEADERS)
}
