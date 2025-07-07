import { createAuthClient as createVanillaClient } from 'better-auth/client'
import { passkeyClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const {
  signIn,
  signOut,
  useSession,
  signUp,
  passkey: passkeyActions,
  useListPasskeys,
  $Infer,
  updateUser,
  changePassword,
  revokeSession,
  revokeSessions,
} = createAuthClient({
  baseURL: import.meta.env.SITE,
  plugins: [passkeyClient()],
})

export const { useSession: useVanillaSession } = createVanillaClient({
  baseURL: import.meta.env.SITE,
})
