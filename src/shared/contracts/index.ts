import { c } from './_base'
import { accountContract } from './account'
import { analyticsContract } from './analytics'
import { authContract } from './auth'

export const apiContract = c.router(
  {
    account: accountContract,
    analytics: analyticsContract,
    auth: authContract,
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
