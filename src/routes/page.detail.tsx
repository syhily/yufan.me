import { data } from 'react-router'

import type { PortableTextBody as PortableTextBodyType } from '@/shared/portable-text'

import { getCatalog, toClientPage, toDetailPageShell } from '@/server/catalog'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { loadPublicDetailData, redirectPermanent } from '@/server/route-helpers/detail-loader'
import { notFound } from '@/server/route-helpers/http'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { assertNotWordPressDecoy } from '@/server/route-helpers/wp-decoy'
import { bundleFromMatches, routeMeta, seoForPage } from '@/server/seo/meta'
import { PageBody, preloadPageBody } from '@/ui/mdx/MdxContent'
import { Friends } from '@/ui/mdx/page/Friends'
import { PortableTextBody } from '@/ui/portable-text/PortableTextBody'
import { PageDetailBody } from '@/ui/post/post/PageDetailBody'

import type { Route } from './+types/page.detail'

export const handle = { footer: false }
export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

interface MdxPageData {
  source: 'mdx'
  mdxPath: string
}

interface DbPageData {
  source: 'db'
  body: PortableTextBodyType
}

type PageBodyData = MdxPageData | DbPageData

export async function loader({ request, context, params }: Route.LoaderArgs) {
  // Probe interception lives HERE (and in `routes/not-found.tsx`)
  // instead of root middleware: a throw originating inside a leaf
  // loader bubbles up to the closest `ErrorBoundary`
  // (`routes/public.layout.tsx`'s, with synchronous `<PublicChrome>`),
  // whereas a throw from a pre-`next()` root middleware forces React
  // Router to render the highest-loaded route's boundary (root) where
  // the chrome only ships through a `React.lazy()` chunk and the
  // header/menu/footer flash in late.
  assertNotWordPressDecoy(request)
  const catalog = await getCatalog()
  const sourcePage = catalog.getPage(params.slug)
  if (!sourcePage) {
    const post = catalog.getPost(params.slug)
    if (post) {
      redirectPermanent(`/posts/${post.slug}`)
    }
    notFound()
  }
  const page = toDetailPageShell(toClientPage(sourcePage))

  // The image source list comes from one of two places: legacy MDX
  // pages have it baked in by `remarkCollectImages` at compile time,
  // DB-backed pages collect it at save time from the PortableText
  // `image` blocks. Either way the SSR layer resolves thumbhash +
  // intrinsic dimensions through the same `image` table cache.
  const imageMeta = Object.fromEntries(await resolveImageMetaBySources(sourcePage.imageSources))

  const bodyData: PageBodyData =
    sourcePage.source === 'mdx'
      ? { source: 'mdx', mdxPath: sourcePage.mdxPath }
      : { source: 'db', body: sourcePage.body }

  const { detail, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    permalink: page.permalink,
    title: page.title,
    preload: sourcePage.source === 'mdx' ? () => preloadPageBody(sourcePage.mdxPath) : () => Promise.resolve(),
  })

  return data(
    {
      page,
      bodyData,
      friends: catalog.friends,
      // Lifted out of `page` so the loader can pass the boolean to the
      // component without growing `DetailPageShell` (the chrome
      // doesn't care about this — only the body rendering does).
      // MDX-sourced pages always read `false` here because they
      // already embed `<Friends />` inline when they want the grid
      // (see `buildPage` in `@/server/catalog/catalog`).
      showFriends: sourcePage.showFriends,
      detail,
      imageMeta,
    },
    { headers: { 'Set-Cookie': commentCsrfSetCookie } },
  )
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const bundle = bundleFromMatches(matches)
  if (!loaderData) {
    return routeMeta(undefined, bundle)
  }
  return routeMeta(seoForPage(loaderData.page), bundle)
}

export default function PageDetailRoute({ loaderData }: Route.ComponentProps) {
  const { page, bodyData, friends, showFriends, detail, imageMeta } = loaderData
  return (
    <PageDetailBody
      page={page}
      headings={page.headings}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentCsrfToken={detail.csrfToken}
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
    >
      {bodyData.source === 'mdx' ? (
        <PageBody path={bodyData.mdxPath} friends={friends} imageMeta={imageMeta} />
      ) : (
        <PortableTextBody body={bodyData.body} imageMeta={imageMeta} headingSlugs={page.headings.map((h) => h.slug)} />
      )}
      {/*
        Meta-driven friends grid. Renders **after** the body so the
        operator can opt into the section without touching the
        PortableText document (and without re-publishing). MDX-sourced
        pages already embed `<Friends />` inline when they want it, so
        `loader` forces `showFriends=false` for them — the catalog
        contract keeps the two paths from double-rendering.
      */}
      {showFriends && <Friends friends={[...friends]} />}
    </PageDetailBody>
  )
}
