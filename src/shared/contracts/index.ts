import { c } from './_base'
import { accountContract } from './account'
import { analyticsContract } from './analytics'
import { authContract } from './auth'
import { commentContract } from './comment'
import { imageContract } from './image'
import { musicContract } from './music'

export const apiContract = c.router(
  {
    account: accountContract,
    analytics: analyticsContract,
    auth: authContract,
    comment: commentContract,
    image: imageContract,
    music: musicContract,
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
