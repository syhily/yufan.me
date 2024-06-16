import { getConfig } from '@/components/comment/artalk';
import { urlJoin } from '@/helpers/tools';
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const GET: APIRoute = async ({ url }) => {
  const email = url.searchParams.get('email');
  if (email == null) {
    return new Response('');
  }

  const config = await getConfig();
  if (config === null) {
    return new Response('');
  }

  // Decode the email into Gravatar hash.
  const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return new Response(urlJoin(config.frontend_conf.gravatar.mirror, `${hash}?d=mm&s=80`));
};
