/// <reference path="../.astro/types.d.ts" />

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
