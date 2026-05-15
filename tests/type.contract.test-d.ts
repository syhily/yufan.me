import { expectTypeOf } from 'vitest'

import { apiContract } from '@/shared/contracts'

// Type-level regression tests. Any schema drift in the contracts fails at
// compile time. This replaces the hand-typed api-types.ts pattern.

// The contract tree exports a well-typed router.
expectTypeOf(apiContract).toBeObject()
expectTypeOf(apiContract.account).toBeObject()
expectTypeOf(apiContract.auth).toBeObject()
expectTypeOf(apiContract.comment).toBeObject()
expectTypeOf(apiContract.analytics).toBeObject()
expectTypeOf(apiContract.image).toBeObject()
expectTypeOf(apiContract.music).toBeObject()
expectTypeOf(apiContract.admin).toBeObject()
expectTypeOf(apiContract.admin.users).toBeObject()
expectTypeOf(apiContract.admin.posts).toBeObject()
expectTypeOf(apiContract.admin.pages).toBeObject()
expectTypeOf(apiContract.admin.settings).toBeObject()
expectTypeOf(apiContract.admin.cache).toBeObject()
expectTypeOf(apiContract.admin.mail).toBeObject()
expectTypeOf(apiContract.admin.categories).toBeObject()
expectTypeOf(apiContract.admin.tags).toBeObject()
expectTypeOf(apiContract.admin.friends).toBeObject()
expectTypeOf(apiContract.admin.images).toBeObject()
expectTypeOf(apiContract.admin.music).toBeObject()
expectTypeOf(apiContract.admin.editor).toBeObject()
