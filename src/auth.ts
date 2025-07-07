import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from 'astro:env/server'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, haveIBeenPwned, magicLink } from 'better-auth/plugins'
import { passkey } from 'better-auth/plugins/passkey'
import { db } from '@/helpers/db/pool'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    admin(),
    haveIBeenPwned(),
    passkey(),
    magicLink({
      sendMagicLink: async ({ email, token, url }, _request) => {
        // TODO send email to user
        console.warn(email, token, url)
      },
    }),
  ],
  rateLimit: {
    enabled: true,
  },
})
