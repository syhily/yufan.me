import { c } from './_base'
import { accountContract } from './account'
import { adminContract } from './admin'
import { analyticsContract } from './analytics'
import { authContract } from './auth'
import { commentContract } from './comment'
import { commentAdminContract } from './comment-admin'
import { imageContract } from './image'
import { musicContract } from './music'

export const apiContract = c.router({
  account: accountContract,
  admin: adminContract,
  analytics: analyticsContract,
  auth: authContract,
  comment: commentContract,
  commentAdmin: commentAdminContract,
  image: imageContract,
  music: musicContract,
})

export type ApiContract = typeof apiContract
