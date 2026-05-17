import type {
  AssetsSettings,
  CommentsSettings,
  ContentSettings,
  FontsSettings,
  NavigationSettings,
  SidebarSettings,
  SocialsSettings,
} from '@/shared/config/blog'

/**
 * Aggregated input data collected across the 5 form steps of the install
 * wizard. Step 6 (confirm) is read-only and does not contribute new fields.
 *
 * This DTO is POSTed as JSON from the client in the final step and
 * decomposed into per-section payloads on the server.
 */
export interface InstallWizardData {
  // ── Step 1: Site Identity (general) ──
  title: string
  description: string
  website: string
  keywords: string[]
  locale: string
  timeZone: string
  timeFormat: string
  initialYear: number
  icpNo?: string
  moeIcpNo?: string

  // ── Step 2: Navigation & Socials ──
  navigation: NavigationSettings['navigation']
  socials: SocialsSettings['socials']

  // ── Step 3: Appearance & Sidebar ──
  sidebar: SidebarSettings['sidebar']
  fonts: FontsSettings

  // ── Step 4: Content & Comments ──
  content: ContentSettings
  comments: CommentsSettings['comments']

  // ── Step 5: Services (assets + mail + search) ──
  assets: AssetsSettings
  mail: { enabled: boolean; host: string; apiKey: string; sender: string }
  search: {
    enabled: boolean
    mode: 'vector' | 'like'
    endpoint: string
    apiKey: string
    model: string
    similarityThreshold: number
  }
}

/**
 * SessionStorage payload. Stores both the accumulated wizard data and
 * navigation progress so a refresh lands the user back at the correct step
 * without losing already-entered values.
 */
export interface InstallWizardSession {
  data: InstallWizardData
  currentStep: number
  maxReachedStep: number
}
