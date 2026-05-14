import { c } from './_base'
import { accountContract } from './account'
import { authContract } from './auth'

export const apiContract = c.router(
  {
    account: accountContract,
    auth: authContract,
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
