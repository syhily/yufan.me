import { Buffer } from 'node:buffer'

import config from '@/blog.config'
import { AvatarStatus, cacheAvatar, loadAvatar } from '@/server/cache/avatar'
import { findEmailById } from '@/server/db/query/user'
import { compressImage } from '@/server/images/compress'
import { pngResponse } from '@/server/route-helpers/http'
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

async function avatarImage(hash: string): Promise<Buffer | null> {
  const defaultAvatarLink = defaultAvatar()
  const link = joinUrl(
    config.settings.comments.avatar.mirror,
    `${hash}?s=${config.settings.comments.avatar.size}&d=${encodeURIComponent(defaultAvatarLink)}`,
  )
  const resp = await fetch(link, {
    redirect: 'manual',
    headers: { Referer: config.website, Accept: 'image/png' },
  })
  if (resp.status > 299 || resp.headers.get('location') === defaultAvatarLink) {
    return null
  }
  return compressImage(Buffer.from(await resp.arrayBuffer()))
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
