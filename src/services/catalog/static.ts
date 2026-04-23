import YAML from 'yaml'

type FriendMeta = {
  website: string
  description?: string
  homepage: string
  poster: string
}

const FRIEND_MODULES = import.meta.glob<string>('/src/content/metas/friends.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const FRIENDS = Object.values(FRIEND_MODULES).flatMap((source) => {
  const parsed = YAML.parse(source)
  return Array.isArray(parsed) ? (parsed as FriendMeta[]) : []
})
