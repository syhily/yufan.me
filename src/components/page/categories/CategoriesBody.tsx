import type { Category } from '@/services/catalog/schema'

import { AstroImage } from '@/components/ui/AstroImage'
import { Html } from '@/components/ui/Html'

export interface CategoriesBodyProps {
  title: string
  categories: Category[]
}

export function CategoriesBody({ title, categories }: CategoriesBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <h1 className="post-title mb-3 mb-xl-4">{title}</h1>
        <div className="row g-2 g-md-4 list-grouped mt-3 mt-md-4">
          {categories.map((category) => (
            <div key={category.slug} className="col-md-6">
              <div className="list-item block">
                <div className="media media-3x1">
                  <a href={category.permalink} className="media-content">
                    <AstroImage src={category.cover} alt={category.name} width={600} height={200} />
                  </a>
                </div>
                <div className="list-content">
                  <div className="list-body">
                    <a href={category.permalink} className="list-title h5">
                      {category.name}
                    </a>
                    <div className="list-subtitle d-none d-md-block text-md text-secondary mt-2">
                      <div className="h-1x">
                        <Html html={category.description} />
                      </div>
                    </div>
                  </div>
                  <div className="list-footer mt-2">
                    <div className="text-muted text-sm">
                      <span className="d-inline-block">{`${category.counts} 篇文章`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
