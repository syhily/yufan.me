import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { LatestComment } from '@/shared/comments'

import { Sidebar } from '@/ui/public/Sidebar'

import { makePostList, makeTag } from './_helpers/catalog'
import { renderInRouter } from './_helpers/render'

// Pin a deterministic clock so the TodayCalendar widget produces a stable
// `images/calendar/YYYY/MMDD.png` URL across CI runs.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const sampleRecent: LatestComment[] = [
  {
    permalink: '/posts/hello',
    title: 'Hello',
    author: 'alice',
    authorLink: 'https://alice.example',
  },
  {
    permalink: '/posts/world',
    title: 'World',
    author: 'bob',
    authorLink: '',
  },
]

describe('snapshot: Sidebar', () => {
  it('renders the public sidebar with every widget populated', () => {
    const data = {
      posts: makePostList(3, { slug: 'side' }),
      tags: [
        makeTag({ name: 'typescript', slug: 'typescript', counts: 5 }),
        makeTag({ name: 'react', slug: 'react', counts: 8 }),
      ],
      recentComments: sampleRecent,
    }
    const html = renderInRouter(<Sidebar data={data} />)
    expect(html).toMatchSnapshot()
  })

  it('renders an empty sidebar (every widget hides itself when starved)', () => {
    const data = {
      posts: [],
      tags: [],
      recentComments: [],
    }
    const html = renderInRouter(<Sidebar data={data} />)
    expect(html).toMatchSnapshot()
  })
})
