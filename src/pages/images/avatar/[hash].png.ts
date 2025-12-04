import type { APIRoute } from 'astro'
import { Buffer } from 'node:buffer'
import { joinPaths } from '@astrojs/internal-helpers/path'
import config from '@/blog.config'
import { queryEmail } from '@/helpers/auth/user'
import { AvatarStatus, cacheAvatar, loadAvatar } from '@/helpers/cache'
import { encodedEmail, isNumeric } from '@/helpers/tools'

function defaultAvatar(): string {
  return joinPaths(import.meta.env.SITE, '/images/default-avatar.png')
}

async function avatarImage(hash: string): Promise<Buffer | null> {
  const defaultAvatarLink = defaultAvatar()
  const link = joinPaths(
    config.settings.comments.avatar.mirror,
    `${hash}?s=${config.settings.comments.avatar.size}&d=${encodeURIComponent(defaultAvatarLink)}`,
  )
  const resp = await fetch(link, { redirect: 'manual', headers: { Referer: import.meta.env.SITE, Accept: 'image/png' } })
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
      return new Response(new Uint8Array(avatar.buffer), {
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
    await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return redirect(defaultAvatar())
  }
  const encoded = email.includes('@') ? encodedEmail(email) : email
  const buffer = await avatarImage(encoded)

  if (buffer === null) {
    await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return redirect(defaultAvatar())
  }
  else {
    await cacheAvatar({ email: hash, status: AvatarStatus.HAVE_AVATAR, buffer })
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}
