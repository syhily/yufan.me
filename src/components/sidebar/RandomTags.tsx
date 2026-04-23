import type { Tag } from '@/services/catalog/schema'

import config from '@/blog.config'
import { sampleSize } from '@/shared/tools'

export interface RandomTagsProps {
  tags: Tag[]
}

export function RandomTags({ tags }: RandomTagsProps) {
  const randomSize = config.settings.sidebar.tag
  if (randomSize <= 0) return null
  const topTags = tags
    .slice()
    .sort((a, b) => b.counts - a.counts)
    .slice(0, randomSize * 2)

  return (
    <div id="tag-cloud" className="widget widget-tag-cloud">
      <div className="widget-title" data-tippy-content="流水落花春去也，天上人间。">
        文踪墨迹
      </div>
      <div className="tagcloud">
        {sampleSize(topTags, randomSize).map((tag) => (
          <a
            key={tag.slug}
            href={tag.permalink}
            className="tag-cloud-link"
            title={`${tag.name} (${tag.counts} 篇文章)`}
          >
            {tag.name}
          </a>
        ))}
      </div>
    </div>
  )
}
