import type { MDXComponents } from 'mdx/types'

import browserCollections from '#source/browser'

import { CodeBlock } from '@/ui/mdx/CodeBlock'
import { FootnoteDefinition, FootnoteProvider, FootnoteReference } from '@/ui/mdx/Footnotes'
import { ImageMetaProvider, type ImageMetaMap } from '@/ui/mdx/image-meta-context'
import { MdxImg } from '@/ui/mdx/MdxImg'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Solution } from '@/ui/mdx/solutions/Solution'

// Shared MDX component map for posts. The `img` override routes every
// compiled `<img>` through `<MdxImg>`, which attaches the thumbhash
// background placeholder and lazily resolves missing hashes at hydration
// time for historical MDX builds.
//
// Pages used to live in a sibling Fumadocs collection with a similar
// renderer (`pageClientLoader` / `<PageBody>`); they're now served
// out of Postgres through `<PortableTextBody>`, so the only MDX
// renderer left is the post one.
const POST_MDX_COMPONENTS: MDXComponents = {
  MusicPlayer,
  Solution,
  img: MdxImg,
  li: FootnoteDefinition,
  pre: CodeBlock,
  sup: FootnoteReference,
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

export interface PostBodyProps {
  path: string
  imageMeta?: ImageMetaMap
}

// Render a post MDX body as a live React subtree. The `path` is the compiled
// MDX file path (from `catalog.getPost(slug).mdxPath`) and must be preloaded
// by the loader via `preloadPostBody(path)` so that the first render resolves
// synchronously without suspending.
export function PostBody({ path, imageMeta }: PostBodyProps) {
  return <ImageMetaProvider value={imageMeta}>{postClientLoader.useContent(path)}</ImageMetaProvider>
}

export async function preloadPostBody(path: string): Promise<void> {
  await postClientLoader.preload(path)
}
