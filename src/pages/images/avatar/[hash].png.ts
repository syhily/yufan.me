import type { APIRoute } from 'astro'
import { Buffer } from 'node:buffer'
import { queryEmail } from '@/helpers/auth/user'
import { AvatarStatus, cacheAvatar, loadAvatar } from '@/helpers/cache/redis'
import { encodedEmail, isNumeric, urlJoin } from '@/helpers/tools'
import options from '@/options'

// TODO Add lru-cache for avatar.
// TODO Use types/node-schedule for cache hot load.

function defaultAvatar(): string {
  return urlJoin(options.assetsPrefix(), '/images/default-avatar.png')
}

async function avatarImage(hash: string): Promise<Buffer | null> {
  const defaultAvatarLink = defaultAvatar()
  const link = urlJoin(
    options.settings.comments.avatar.mirror,
    `${hash}?s=${options.settings.comments.avatar.size}&d=${defaultAvatarLink}`,
  )
  const resp = await fetch(link, { redirect: 'manual', headers: { Referer: options.website } })
  if (resp.status > 299 || resp.headers.get('location') === defaultAvatarLink) {
    return null
  }
  return Buffer.from(await resp.arrayBuffer())
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const { hash } = params
  if (!hash) {
    return redirect(defaultAvatar())
  }

  // Read from cache.
  const avatar = await loadAvatar(hash)
  if (avatar != null) {
    if (avatar.status === AvatarStatus.NO_AVATAR) {
      return redirect(defaultAvatar())
    }
    else if (avatar.buffer !== null) {
      return new Response(avatar.buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }
  }

  // Loading logic.
  const email = isNumeric(hash) ? await queryEmail(Number.parseInt(hash)) : hash
  if (email === null) {
    cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return redirect(defaultAvatar())
  }
  const encoded = email.includes('@') ? encodedEmail(email) : email
  const buffer = await avatarImage(encoded)

  if (buffer === null) {
    cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return redirect(defaultAvatar())
  }
  else {
    cacheAvatar({ email: hash, status: AvatarStatus.HAVE_AVATAR, buffer })
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}
