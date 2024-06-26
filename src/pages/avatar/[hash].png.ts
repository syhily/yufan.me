import { queryEmail } from '@/helpers/db/query';
import { encodedEmail, urlJoin } from '@/helpers/tools';
import options from '@/options';
import type { APIRoute, ValidRedirectStatus } from 'astro';

const defaultAvatar = (): string => {
  return urlJoin(options.assetsPrefix(), '/images/default-avatar.png');
};

function isNumeric(str: string) {
  return !Number.isNaN(str) && !Number.isNaN(Number.parseFloat(str));
}

const avatarImage = async (
  hash: string,
  redirect: (path: string, status?: ValidRedirectStatus) => Response,
): Promise<Response> => {
  const defaultAvatarLink = defaultAvatar();
  const link = urlJoin(
    options.settings.comments.avatar.mirror,
    `${hash}.png?s=${options.settings.comments.avatar.size}&d=${defaultAvatarLink}`,
  );

  const resp = await fetch(link, { redirect: 'manual', headers: { Referer: options.website } });
  if (resp.headers.get('location') === defaultAvatarLink) {
    return redirect(defaultAvatarLink, 302);
  }

  return new Response(Buffer.from(await resp.arrayBuffer()), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-control': 'max-age=604800',
    },
  });
};

export const GET: APIRoute = async ({ params, redirect }) => {
  const { hash } = params;
  if (!hash) {
    return redirect(defaultAvatar());
  }

  // This is a existed user.
  if (isNumeric(hash)) {
    const email = await queryEmail(Number(hash));
    if (email === null) {
      return redirect(defaultAvatar());
    }
    return avatarImage(encodedEmail(email), redirect);
  }

  return avatarImage(hash, redirect);
};
