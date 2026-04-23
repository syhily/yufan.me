import type { Buffer } from 'node:buffer'

import config from '@/blog.config'
import { isNumeric } from '@/shared/tools'
import { joinUrl } from '@/shared/urls'

function defaultAvatar(): string {
  return joinUrl(config.website, '/images/default-avatar.png')
}

async function avatarImage(hash: string): Promise<Buffer | null> {
  const [{ Buffer }, { compressImage }] = await Promise.all([import('node:buffer'), import('@/services/images/assets')])
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
  const [{ findEmailById }, { encodedEmail }] = await Promise.all([
    import('@/db/query/user.server'),
    import('@/shared/security'),
  ])
  if (isNumeric(rawHash)) {
    const email = await findEmailById(BigInt(rawHash))
    return email === null ? null : encodedEmail(email)
  }
  return rawHash
}

export async function loader({ params }: { params: { hash?: string } }) {
  const { AvatarStatus, cacheAvatar, loadAvatar } = await import('@/shared/cache.server')
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
      return new Response(new Uint8Array(avatar.buffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }
  }

  const buffer = await avatarImage(canonical)
  if (buffer === null) {
    await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
    return Response.redirect(defaultAvatar())
  }

  await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}
