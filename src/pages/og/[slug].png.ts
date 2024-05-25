import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;

  const response = await fetch('https://docs.astro.build/assets/full-logo-light.png');
  const buffer = Buffer.from(await response.arrayBuffer());

  return new Response(buffer, {
    headers: { 'Content-Type': 'image/png' },
  });
};
