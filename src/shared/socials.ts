// The closed list of "branded" social network identifiers used by the
// `socials[]` settings array. Header maps each value to a fixed icon, and
// the admin SocialsEditor uses the list to populate its network select.
//
// Lives in `@/shared/` because both the server-side Zod schema and the
// admin form editor need the same canonical list, while UI modules are
// forbidden from importing server modules and shared modules cannot
// import from server.
export const SOCIAL_NETWORKS = ['github', 'twitter', 'wechat', 'weibo', 'qq'] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]
