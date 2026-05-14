import { c } from './_base'
import { accountContract } from './account'

export const apiContract = c.router(
  {
    account: accountContract,
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
