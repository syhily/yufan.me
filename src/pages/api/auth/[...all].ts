import { auth } from '@/auth';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (ctx) => {
  return auth.handler(ctx.request);
};

export const ALL: APIRoute = async (ctx) => {
  return auth.handler(ctx.request);
};
