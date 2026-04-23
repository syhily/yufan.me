import type { APIRoute } from 'astro'

import { joinPaths } from '@astrojs/internal-helpers/path'
import { Buffer } from 'node:buffer'

import config from '@/blog.config'
import { findEmailById } from '@/db/query/user'
import { compressImage } from '@/services/images/assets'
import { AvatarStatus, cacheAvatar, loadAvatar } from '@/shared/cache'
import { encodedEmail, isNumeric } from '@/shared/tools'

function defaultAvatar(): string {
  return joinPaths(import.meta.env.SITE, '/images/default-avatar.png')
}

async function avatarImage(hash: string): Promise<Buffer | null> {
  const defaultAvatarLink = defaultAvatar()
  const link = joinPaths(
    config.settings.comments.avatar.mirror,
    `${hash}?s=${config.settings.comments.avatar.size}&d=${encodeURIComponent(defaultAvatarLink)}`,
  )
  const resp = await fetch(link, {
    redirect: 'manual',
    headers: { Referer: import.meta.env.SITE, Accept: 'image/png' },
  })
  if (resp.status > 299 || resp.headers.get('location') === defaultAvatarLink) {
    return null
  }
  return compressImage(Buffer.from(await resp.arrayBuffer()))
}

// Normalize the avatar cache key so a user accessed both as `/{userId}.png`
// and as `/{sha256(email)}.png` shares one cache entry. We keep two
// indirections:
//   - `numeric id` → email (DB lookup)
//   - email → sha256 hash (deterministic; matches Gravatar's modern hashing)
// The canonical cache key is always `avatar:<sha256hash>`.
async function resolveCanonicalKey(rawHash: string): Promise<string | null> {
  if (isNumeric(rawHash)) {
    const email = await findEmailById(BigInt(rawHash))
    return email === null ? null : encodedEmail(email)
  }
  // Already a sha256 hex digest. Treat as canonical.
  return rawHash
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const { hash } = params
  if (!hash) {
    return redirect(defaultAvatar())
  }

  const canonical = await resolveCanonicalKey(hash)
  if (canonical === null) {
    await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
    return redirect(defaultAvatar())
  }

  // Read from cache (canonical key).
  const avatar = await loadAvatar(canonical)
  if (avatar !== null) {
    if (avatar.status === AvatarStatus.NO_AVATAR) {
      return redirect(defaultAvatar())
    } else if (avatar.buffer !== null) {
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
    return redirect(defaultAvatar())
  }

  await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}
