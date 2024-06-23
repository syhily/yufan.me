import { queryEmail } from '@/helpers/db/query';
import { encodedEmail, urlJoin } from '@/helpers/tools';
import options from '@/options';
import type { APIRoute } from 'astro';

const defaultAvatar = (): string => {
  return urlJoin(options.assetsPrefix(), '/images/default-avatar.png');
};

function isNumeric(str: string) {
  return !Number.isNaN(str) && !Number.isNaN(Number.parseFloat(str));
}

const avatarImage = async (hash: string): Promise<Response> => {
  const link = urlJoin(
    options.settings.comments.avatar.mirror,
    `${hash}.png?s=${options.settings.comments.avatar.size}&d=${defaultAvatar()}`,
  );
  console.log(link);
  return new Response(Buffer.from(await (await fetch(link)).arrayBuffer()), {
    headers: { 'Content-Type': 'image/png' },
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
    return avatarImage(encodedEmail(email));
  }

  return avatarImage(hash);
};
