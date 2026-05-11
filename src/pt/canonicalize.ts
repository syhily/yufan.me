import { prerenderPortableTextBody } from '@/pt/prerender'
import { validatePortableTextBody, type PortableTextBody } from '@/pt/schema'

export async function canonicalizePortableTextBody(input: unknown): Promise<PortableTextBody> {
  const body = validatePortableTextBody(input)
  await prerenderPortableTextBody(body)
  return body
}
