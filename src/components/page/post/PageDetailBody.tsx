import type { AstroSession } from 'astro'
import type { MarkdownHeading } from 'astro'
import type { ReactNode } from 'react'

import { joinPaths } from '@astrojs/internal-helpers/path'

import config from '@/blog.config'
import { Comments } from '@/components/comment/Comments'
import { LikeButton } from '@/components/like/LikeButton'
import { TableOfContents } from '@/components/page/toc/TableOfContents'
import { Footer } from '@/components/partial/Footer'
import { type Page } from '@/services/catalog/schema'

export interface PageDetailBodyProps {
  page: Page
  headings: MarkdownHeading[]
  session: AstroSession | undefined
  /** MDX-rendered `<Content />` body is injected here by the `.astro` shell. */
  children: ReactNode
}

export function PageDetailBody({ page, headings, session, children }: PageDetailBodyProps) {
  return (
    <div className="row gx-0">
      <div className="col-lg-8 col-xl-8">
        <div className="post p-3 p-md-5">
          <h1 className="post-title mb-3 mb-xl-4">{page.title}</h1>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="post-content">{children}</div>
          <LikeButton permalink={page.permalink} />
          {page.comments && (
            <Comments
              commentKey={joinPaths(config.website, page.permalink, '/')}
              title={page.title}
              session={session}
            />
          )}
        </div>
        <Footer />
      </div>
      <div className="col-lg-4 col-xl-4 d-none d-lg-block sticky-top hv">
        <div className="bg-img hv" style={{ backgroundImage: `url('${page.cover}')` }} />
      </div>
    </div>
  )
}
