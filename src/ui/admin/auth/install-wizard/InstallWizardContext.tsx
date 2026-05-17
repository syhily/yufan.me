import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type { InstallWizardData, InstallWizardSession } from '@/shared/types/install'

const STORAGE_KEY = 'yufan.me:install-wizard'
const TOTAL_STEPS = 6

/** Seed data used when the wizard starts fresh (no SessionStorage entry). */
export const DEFAULT_WIZARD_DATA: InstallWizardData = {
  // ── Step 1: Site Identity ──
  title: '',
  description: '',
  website: '',
  keywords: [],
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
  timeFormat: 'yyyy-MM-dd HH:mm',
  initialYear: new Date().getFullYear(),
  icpNo: '',
  moeIcpNo: '',

  // ── Step 2: Navigation & Socials ──
  navigation: { sideNav: [], footerNav: [] },
  socials: [],

  // ── Step 3: Appearance & Sidebar ──
  sidebar: {
    widgets: [
      { type: 'search', enabled: false },
      { type: 'recentPosts', enabled: false, count: 5 },
      { type: 'recentComments', enabled: false, count: 5 },
      { type: 'randomTags', enabled: false, count: 20 },
      { type: 'todayCalendar', enabled: false },
    ],
  },
  fonts: { og: { url: '' }, calendar: { url: '' }, globalCss: [], postCss: [] },

  // ── Step 4: Content & Comments ──
  content: {
    pagination: { posts: 10, category: 10, tags: 10, search: 10 },
    feed: { full: false, size: 20 },
    post: { sort: 'desc', sortBy: 'publishedAt', featureEnabled: false },
    footnotes: { sectionTitle: '尾声礼记' },
  },
  comments: {
    size: 10,
    avatar: { mirror: 'https://www.gravatar.com/avatar', size: 80 },
    tokenTtlSeconds: 1800,
  },

  // ── Step 5: Services ──
  assets: {
    asset: { host: '', scheme: 'https' },
    storage: {
      enabled: false,
      endpoint: '',
      region: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: false,
      urlTemplate: '',
    },
    upload: { maxBytes: 8 * 1024 * 1024, jpegQuality: 82 },
  },
  mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@example.com' },
  search: {
    enabled: false,
    mode: 'like',
    endpoint: '',
    apiKey: '',
    model: 'text-embedding-3-small',
    similarityThreshold: 0.5,
  },
}

function readSession(): InstallWizardSession | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as InstallWizardSession
  } catch {
    return null
  }
}

function writeSession(session: InstallWizardSession): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore quota exceeded
  }
}

export function clearInstallSession(): void {
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.removeItem(STORAGE_KEY)
}

export interface InstallWizardContextValue {
  /** Aggregated data across all 5 form steps. */
  data: InstallWizardData
  /** Replace wizard data with an updater function (mirrors React setState). */
  updateData: (updater: (prev: InstallWizardData) => InstallWizardData) => void
  /** Current visible step (1–6). */
  currentStep: number
  /** Furthest step the user has ever reached (controls Stepper clickability). */
  maxReachedStep: number
  /** Jump to a specific step (clamped to 1–6, updates maxReachedStep). */
  goToStep: (step: number) => void
  /** Advance to next step if not already at the end. */
  nextStep: () => void
  /** Retreat to previous step if not already at the start. */
  prevStep: () => void
  /** True when the given step has been reached at least once. */
  canAccessStep: (step: number) => boolean
  /** Wipe SessionStorage and reset all state to defaults. */
  clearWizard: () => void
}

const InstallWizardContext = createContext<InstallWizardContextValue | null>(null)

export function InstallWizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<InstallWizardData>(() => readSession()?.data ?? DEFAULT_WIZARD_DATA)
  const [currentStep, setCurrentStep] = useState(() => readSession()?.currentStep ?? 1)
  const [maxReachedStep, setMaxReachedStep] = useState(() => readSession()?.maxReachedStep ?? 1)

  const updateData = useCallback((updater: (prev: InstallWizardData) => InstallWizardData) => {
    setData(updater)
  }, [])

  const goToStep = useCallback((step: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_STEPS, step))
    setCurrentStep(clamped)
    setMaxReachedStep((prev) => Math.max(prev, clamped))
  }, [])

  const nextStep = useCallback(() => {
    goToStep(currentStep + 1)
  }, [currentStep, goToStep])

  const prevStep = useCallback(() => {
    goToStep(currentStep - 1)
  }, [currentStep, goToStep])

  const canAccessStep = useCallback(
    (step: number) => {
      return step >= 1 && step <= maxReachedStep
    },
    [maxReachedStep],
  )

  const clearWizard = useCallback(() => {
    clearInstallSession()
    setData(DEFAULT_WIZARD_DATA)
    setCurrentStep(1)
    setMaxReachedStep(1)
  }, [])

  // Persist to sessionStorage on every meaningful change.
  useEffect(() => {
    writeSession({ data, currentStep, maxReachedStep })
  }, [data, currentStep, maxReachedStep])

  return (
    <InstallWizardContext.Provider
      value={{
        data,
        updateData,
        currentStep,
        maxReachedStep,
        goToStep,
        nextStep,
        prevStep,
        canAccessStep,
        clearWizard,
      }}
    >
      {children}
    </InstallWizardContext.Provider>
  )
}

export function useInstallWizard(): InstallWizardContextValue {
  const ctx = useContext(InstallWizardContext)
  if (!ctx) {
    throw new Error('useInstallWizard must be used within InstallWizardProvider')
  }
  return ctx
}
