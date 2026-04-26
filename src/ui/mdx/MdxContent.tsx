import type { MDXComponents } from 'mdx/types'

import browserCollections from '#source/browser'

import type { Friend } from '@/server/catalog'

import { CodeBlock } from '@/ui/mdx/CodeBlock'
import { FootnoteDefinition, FootnoteProvider, FootnoteReference } from '@/ui/mdx/Footnotes'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Friends } from '@/ui/mdx/page/Friends'
import { Solution } from '@/ui/mdx/solutions/Solution'

// Shared MDX component map for posts. The `img` override routes every
// compiled `<img>` through `<MdxImg>`, which only needs to attach the
// thumbhash background placeholder — `width`, `height`, the upyun-rewritten
// `src`, and `data-thumbhash` are all baked in at compile time by
// `rehype-image-enhance.server.ts`.
const POST_MDX_COMPONENTS: MDXComponents = {
  MusicPlayer,
  Solution,
  img: MdxImg,
  li: FootnoteDefinition,
  pre: CodeBlock,
  sup: FootnoteReference,
}

// `pageComponents` is called on every MDX body render, but `friends` is
// loader-stable (the catalog reuses the same array reference across
// revalidations). Cache the components map by friends reference so the
// MDX subtree gets the same `MDXComponents` object — and the same inline
// `Friends` component — across re-renders. That keeps `<Body components={…}/>`
// from forcing every child component to reconcile against a fresh prop
// identity on each parent render.
const pageComponentsCache = new WeakMap<readonly Friend[], MDXComponents>()

function pageComponents(friends: readonly Friend[]): MDXComponents {
  const cached = pageComponentsCache.get(friends)
  if (cached !== undefined) return cached

  const friendsArray = [...friends]
  const FriendsComponent = () => <Friends friends={friendsArray} />
  const components: MDXComponents = {
    MusicPlayer,
    Solution,
    img: MdxImg,
    li: FootnoteDefinition,
    pre: CodeBlock,
    sup: FootnoteReference,
    Friends: FriendsComponent,
  }
  pageComponentsCache.set(friends, components)
  return components
}

const postClientLoader = browserCollections.posts.createClientLoader({
  id: 'posts',
  component(loaded) {
    const Body = loaded.default
    return (
      <FootnoteProvider>
        <Body components={POST_MDX_COMPONENTS} />
      </FootnoteProvider>
    )
  },
})

interface PageLoaderProps {
  friends: readonly Friend[]
}

const pageClientLoader = browserCollections.pages.createClientLoader<PageLoaderProps>({
  id: 'pages',
  component(loaded, props) {
    const Body = loaded.default
    return (
      <FootnoteProvider>
        <Body components={pageComponents(props.friends)} />
      </FootnoteProvider>
    )
  },
})

export interface PostBodyProps {
  path: string
}

// Render a post MDX body as a live React subtree. The `path` is the compiled
// MDX file path (from `catalog.getPost(slug).mdxPath`) and must be preloaded
// by the loader via `preloadPostBody(path)` so that the first render resolves
// synchronously without suspending.
export function PostBody({ path }: PostBodyProps) {
  return postClientLoader.useContent(path)
}

export interface PageBodyProps {
  path: string
  friends: readonly Friend[]
}

// Render a page MDX body. Pages can embed `<Friends />`, so we pass the
// friends list through as props instead of reading the catalog singleton
// from inside the MDX components (which wouldn't serialize to the client).
export function PageBody({ path, friends }: PageBodyProps) {
  return pageClientLoader.useContent(path, { friends })
}

export async function preloadPostBody(path: string): Promise<void> {
  await postClientLoader.preload(path)
}

export async function preloadPageBody(path: string): Promise<void> {
  await pageClientLoader.preload(path)
}
