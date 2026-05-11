import OpenAI from 'openai'

import { getLogger } from '@/server/logger'
import { getBlogSettingsBundleSync } from '@/shared/blog-config'

function getClient(): OpenAI | null {
  const bundle = getBlogSettingsBundleSync()
  if (bundle === null) {
    return null
  }

  const settings = bundle.search?.search
  if (!settings?.enabled || !settings.apiKey) {
    return null
  }

  const options: ConstructorParameters<typeof OpenAI>[0] = { apiKey: settings.apiKey }
  if (settings.endpoint && settings.endpoint.trim() !== '') {
    options.baseURL = settings.endpoint.trim()
  }
  return new OpenAI(options)
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getClient()
  if (client === null) {
    return null
  }

  const bundle = getBlogSettingsBundleSync()
  const model = bundle?.search?.search.model || 'text-embedding-3-small'

  const input = text.replaceAll('\n', ' ').slice(0, 8000)
  try {
    const response = await client.embeddings.create({ model, input, dimensions: 1536 })
    const embedding = response.data?.[0]?.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      getLogger('search.openai').error('Embedding generation returned invalid data', {
        model,
        hasData: response.data !== undefined,
        dataLength: response.data?.length,
        embeddingType: typeof embedding,
        hint: 'The configured endpoint or model may not support embeddings. Use a dedicated embedding model (e.g. text-embedding-3-small).',
      })
      return null
    }
    return embedding
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isModelMismatch =
      message.includes('not open') || message.includes('undefined') || message.includes('Cannot read properties')
    getLogger('search.openai').error('Embedding generation failed', {
      error: message,
      model,
      hint: isModelMismatch
        ? 'The configured model may not support embeddings. Use a dedicated embedding model (e.g. text-embedding-3-small) instead of a chat model.'
        : undefined,
    })
    return null
  }
}
