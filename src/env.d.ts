/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/vanillajs" />

declare namespace App {
  interface SessionData {
    user: {
      id: bigint
      name: string
      email: string
      website: string | null
      admin: boolean
    }
    csrf: {
      token: string
      timestamp: number
    }
  }
}
