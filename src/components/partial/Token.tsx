import type { AstroSession } from 'astro'

import { generateToken } from '@/services/auth/csrf'

export interface TokenProps {
  session: AstroSession | undefined
}

export function Token({ session }: TokenProps) {
  const token = session ? generateToken(session) : 'Please configure your astro session'
  return <input type="hidden" name="token" value={token} />
}
