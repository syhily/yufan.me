import { c } from './_base'

export const apiContract = c.router({}, { pathPrefix: '/api' })

export type ApiContract = typeof apiContract
