import type { APIRoute, ValidRedirectStatus } from 'astro'
import { Buffer } from 'node:buffer'
import { queryEmail } from '@/helpers/db/query'
import { encodedEmail, isNumeric, urlJoin } from '@/helpers/tools'
import options from '@/options'

// TODO Add lru-cache for avatar.
// TODO Use types/node-schedule for cache hot load.

function defaultAvatar(): string {
  return urlJoin(options.assetsPrefix(), '/images/default-avatar.png')
}

async function avatarImage(hash: string, redirect: (path: string, status?: ValidRedirectStatus) => Response): Promise<Response> {
  const defaultAvatarLink = defaultAvatar()
  const link = urlJoin(
    options.settings.comments.avatar.mirror,
    `${hash}?s=${options.settings.comments.avatar.size}&d=${defaultAvatarLink}`,
  )

  const resp = await fetch(link, { redirect: 'manual', headers: { Referer: options.website } })
  if (resp.headers.get('location') === defaultAvatarLink) {
    return redirect(defaultAvatarLink, 302)
  }

  return new Response(Buffer.from(await resp.arrayBuffer()), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const { hash } = params
  if (!hash) {
    return redirect(defaultAvatar())
  }

  // This is a existed user.
  if (isNumeric(hash)) {
    const email = await queryEmail(Number.parseInt(hash))
    if (email === null) {
      return redirect(defaultAvatar())
    }
    return avatarImage(encodedEmail(email), redirect)
  }

  return avatarImage(hash, redirect)
}
