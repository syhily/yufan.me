import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { LatestComment } from '@/server/comments/types'

import { Sidebar } from '@/ui/sidebar/Sidebar'

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

const samplePending: LatestComment[] = [
  {
    permalink: '/posts/pending',
    title: 'Awaiting moderation',
    author: 'spam',
    authorLink: '',
  },
]

describe('snapshot: Sidebar (all 6 widgets)', () => {
  it('renders the public (non-admin) sidebar with every widget populated', () => {
    const data = {
      posts: makePostList(3, { slug: 'side' }),
      tags: [
        makeTag({ name: 'typescript', slug: 'typescript', counts: 5 }),
        makeTag({ name: 'react', slug: 'react', counts: 8 }),
      ],
      recentComments: sampleRecent,
      pendingComments: samplePending,
    }
    const html = renderInRouter(<Sidebar data={data} admin={false} />)
    expect(html).toMatchSnapshot()
  })

  it('renders the admin sidebar with the pending-comments widget visible', () => {
    const data = {
      posts: makePostList(2, { slug: 'side-admin' }),
      tags: [makeTag({ name: 'typescript', slug: 'typescript', counts: 5 })],
      recentComments: sampleRecent,
      pendingComments: samplePending,
    }
    const html = renderInRouter(<Sidebar data={data} admin />)
    expect(html).toMatchSnapshot()
  })

  it('renders an empty sidebar (every widget hides itself when starved)', () => {
    const data = {
      posts: [],
      tags: [],
      recentComments: [],
      pendingComments: [],
    }
    const html = renderInRouter(<Sidebar data={data} admin={false} />)
    expect(html).toMatchSnapshot()
  })
})
