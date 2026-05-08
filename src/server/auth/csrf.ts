import { createCookie } from 'react-router'

import { SESSION_SECRET } from '@/server/env'
import { makeToken, timingSafeEqual } from '@/shared/security'

const CSRF_TOKEN_TTL_SECONDS = 60 * 5
const CSRF_TOKEN_LENGTH = 48

const csrfCookie = createCookie('csrf-token', {
  httpOnly: true,
  maxAge: CSRF_TOKEN_TTL_SECONDS,
  path: '/',
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  secrets: [SESSION_SECRET],
})

export interface IssuedCsrfToken {
  token: string
  setCookie: string
}

export async function issueCsrfToken(): Promise<IssuedCsrfToken> {
  const token = makeToken(CSRF_TOKEN_LENGTH)
  const setCookie = await csrfCookie.serialize(token)
  return { token, setCookie }
}

export async function validateRequestCsrf(request: Request, formToken: string | undefined): Promise<[boolean, string]> {
  if (formToken === undefined || formToken === '') {
    return [false, 'Missing CSRF token in form submission']
  }
  const cookieHeader = request.headers.get('Cookie')
  const cookieToken = (await csrfCookie.parse(cookieHeader)) as string | null
  if (cookieToken === null || cookieToken === '') {
    return [false, 'Missing or expired CSRF cookie']
  }
  if (!timingSafeEqual(cookieToken, formToken)) {
    return [false, 'CSRF token mismatch']
  }
  return [true, '']
}

export async function clearCsrfCookie(): Promise<string> {
  return csrfCookie.serialize('', { maxAge: 0 })
}
