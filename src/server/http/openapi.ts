// Auto-generated OpenAPI 3.0 document from `apiContract`.
//
// Mounted at `/openapi.json` (and rendered through Swagger UI at
// `/docs`) by `src/entry/server.node.ts` when `NODE_ENV !==
// 'production'`. Generation is pure-data — `generateOpenApi` walks
// the contract once and emits the spec, no runtime cost outside
// the dev / staging paths that import this file.

import { generateOpenApi } from '@ts-rest/open-api'

import { apiContract } from '@/shared/contracts'

export function buildOpenApiDocument(): ReturnType<typeof generateOpenApi> {
  return generateOpenApi(apiContract, {
    info: {
      title: 'Yufan.me API',
      version: '1.0.0',
      description: 'Internal API for the yufan.me blog platform. Generated from `shared/contracts`.',
    },
    servers: [{ url: '/', description: 'current origin' }],
  })
}
