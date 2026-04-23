export interface SessionUser {
  id: string
  name: string
  email: string
  website: string | null
  admin: boolean
}

export interface CsrfSessionValue {
  token: string
  timestamp: number
}

export interface BlogSessionData {
  user?: SessionUser
  csrf?: CsrfSessionValue
}
