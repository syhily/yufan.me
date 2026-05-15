import { c } from './_base'
import { accountContract } from './account'
import { adminContract } from './admin'
import { analyticsContract } from './analytics'
import { commentAdminContract } from './comment-admin'
import { commentPublicContract } from './comment-public'
import { commentSelfContract } from './comment-self'
import { commentTokenContract } from './comment-token'
import { imageContract } from './image'
import { musicContract } from './music'

export const apiContract = c.router({
  account: accountContract,
  admin: adminContract,
  analytics: analyticsContract,
  commentAdmin: commentAdminContract,
  commentPublic: commentPublicContract,
  commentSelf: commentSelfContract,
  commentToken: commentTokenContract,
  image: imageContract,
  music: musicContract,
})

export type ApiContract = typeof apiContract
