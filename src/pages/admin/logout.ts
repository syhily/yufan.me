import type { APIRoute } from 'astro'
import { logout } from '@/helpers/auth/session'

export const GET: APIRoute = async ({ session, redirect }) => {
  if (session === undefined) {
    throw new Error('Please configure your astro session store')
  }
  logout(session)
  return redirect(import.meta.env.SITE)
}
