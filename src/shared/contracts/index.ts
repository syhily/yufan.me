// Aggregated `apiContract` — the project's single source of truth
// for every HTTP endpoint. Importable from both the server bundle
// (mounted onto Hono) and the client bundle (type-safe ts-rest
// client). See migration plan Part 3.5.

import { c } from '@/shared/contracts/_base'
import { accountContract } from '@/shared/contracts/account'

// **Why no `pathPrefix: '/api'` here**: applying the prefix inside
// the contract aggregator forces every `R['path']` to be rewritten
// through `RecursivelyApplyOptions`, which breaks structural
// assignability between `accountContract.updateProfile.path`
// (`'/account/profile'`) and `apiContract.account.updateProfile.path`
// (`'/api/account/profile'`). Controllers typed via
// `ContractImpl<typeof accountContract>` then fail to mount through
// `apiContract.account`.
//
// We push the `/api` prefix to the **runtime mount** instead:
// `src/entry/server.node.ts` mounts `createApiApp()` at `/api`.
// The contract tree stays one-to-one with the controller tree.
export const apiContract = c.router({
  account: accountContract,
})

export type ApiContract = typeof apiContract
