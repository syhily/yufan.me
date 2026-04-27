import { Link } from 'react-router'

import type { ClientCategory } from '@/server/catalog'

import { postMdxComponents } from '@/ui/mdx/MdxContent'
import { MdxRemoteBody } from '@/ui/mdx/MdxRemoteBody'
import { Container } from '@/ui/primitives/Container'
import { Heading } from '@/ui/primitives/Heading'
import { Image } from '@/ui/primitives/Image'
import { Media } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'

export interface CategoriesBodyProps {
  title: string
  categories: ClientCategory[]
}

export function CategoriesBody({ title, categories }: CategoriesBodyProps) {
  return (
    <div className="lg:px-2 2xl:px-5 py-3 md:py-4 2xl:py-5">
      <Container>
        <Heading level={1} className="mb-3 xl:mb-4">
          {title}
        </Heading>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4 mt-3 md:mt-4">
          {categories.map((category) => (
            <div key={category.slug} className="flex min-w-0">
              <div className="relative flex flex-col flex-auto min-w-0 break-words mb-3 md:mb-5 2xl:mb-7 border-0 rounded-none bg-white shadow-[0_0_30px_0_rgb(40_49_73/0.02)]">
                <Media ratio="3x1">
                  <MediaCover as={Link} to={category.permalink} prefetch="intent">
                    <Image
                      src={category.cover}
                      alt={category.name}
                      width={600}
                      height={200}
                      thumbhash={category.coverThumbhash}
                    />
                  </MediaCover>
                </Media>
                <div className="flex flex-col flex-auto justify-center px-5 py-4">
                  <div className="flex-auto">
                    <Link
                      to={category.permalink}
                      className="block text-[1.25rem] font-semibold text-inherit hover:text-accent"
                      prefetch="intent"
                    >
                      {category.name}
                    </Link>
                    {category.description !== null && (
                      <div className="hidden md:block text-md text-foreground-soft mt-2 line-clamp-1">
                        <MdxRemoteBody compiled={category.description.compiled} components={postMdxComponents} />
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-foreground-muted text-sm">
                      <span className="inline-block">{`${category.counts} 篇文章`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}
