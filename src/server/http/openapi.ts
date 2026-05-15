import { generateOpenApi } from '@ts-rest/open-api'

import { apiContract } from '@/shared/contracts'

export function buildOpenApiDocument() {
  return generateOpenApi(apiContract, {
    info: {
      title: 'Yufan.me API',
      version: '1.0.0',
      description: 'Internal API for the Yufan.me blog platform.',
    },
    servers: [{ url: '/', description: 'current origin' }],
  })
}
