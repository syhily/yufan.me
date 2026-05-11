import { prerenderPortableTextBody } from '@/server/pt/prerender'
import { validatePortableTextBody, type PortableTextBody } from '@/shared/pt/schema'

export async function canonicalizePortableTextBody(input: unknown): Promise<PortableTextBody> {
  const body = validatePortableTextBody(input)
  await prerenderPortableTextBody(body)
  return body
}
