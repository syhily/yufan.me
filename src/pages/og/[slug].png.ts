import { defaultOpenGraph, drawOpenGraph } from '@/helpers/og';
import { getPage, getPost, options } from '@/helpers/schema';
import type { APIRoute } from 'astro';

const fallback = () =>
  new Response(defaultOpenGraph, {
    headers: { 'Content-Type': 'image/png' },
  });

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return fallback();
  }

  let title: string;
  let summary: string;
  let cover: string;

  // Query the post
  const post = getPost(slug);
  if (!post) {
    // Fallback to query from pages
    const page = getPage(slug);
    if (!page) {
      return fallback();
    }

    title = page.title;
    summary = '';
    cover = page.cover.src;
  } else {
    title = post.title;
    summary = post.summary;
    cover = post.cover.src;
  }

  // Fetch the cover image as the background
  const coverImageUrl = cover.startsWith('/') ? options.website + cover : cover;
  const buffer = await drawOpenGraph({ title, summary, coverImageUrl });

  return new Response(buffer, {
    headers: { 'Content-Type': 'image/png' },
  });
};
