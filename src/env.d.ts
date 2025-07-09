/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/vanillajs" />

declare namespace App {
  interface SessionData {
    user: {
      id: string
      name: string
      email: string
      website: string
      role: string
    }
    csrf: {
      token: string
      timestamp: number
    }
  }
}
