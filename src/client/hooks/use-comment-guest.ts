import { useCallback, useEffect, useState } from 'react'

export interface CommentGuestProfile {
  name: string
  email: string
  link?: string
  avatar?: string
}

const STORAGE_KEY = 'comment-guest-profile'

function readProfile(): CommentGuestProfile | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { name?: unknown }).name === 'string' &&
      typeof (parsed as { email?: unknown }).email === 'string'
    ) {
      return parsed as CommentGuestProfile
    }
  } catch {
    // ignore malformed storage
  }
  return null
}

function writeProfile(profile: CommentGuestProfile): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

function removeProfile(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export function useCommentGuest() {
  const [profile, setProfileState] = useState<CommentGuestProfile | null>(null)

  useEffect(() => {
    setProfileState(readProfile())
  }, [])

  const saveProfile = useCallback((next: CommentGuestProfile) => {
    writeProfile(next)
    setProfileState(next)
  }, [])

  const clearProfile = useCallback(() => {
    removeProfile()
    setProfileState(null)
  }, [])

  return { profile, saveProfile, clearProfile }
}
