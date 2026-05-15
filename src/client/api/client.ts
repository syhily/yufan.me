import { initClient } from '@ts-rest/core'

import { apiContract } from '@/shared/contracts'

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {
    'Content-Type': 'application/json',
  },
})
