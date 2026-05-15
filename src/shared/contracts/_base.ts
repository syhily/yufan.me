// Single project-wide ts-rest contract factory.
//
// All contract files under `src/shared/contracts/**` import `c` from
// here so the tree shares one `initContract()` instance. See
// `docs/hono-api-migration-plan.md` Part 3.2.

import { initContract } from '@ts-rest/core'

export const c = initContract()
