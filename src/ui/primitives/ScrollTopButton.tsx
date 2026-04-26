import { useEffect, useState } from 'react'

import { ArrowUpIcon } from '@/ui/icons/icons'

// Scroll-to-top button. Becomes visible only once the reader has moved past
// the initial viewport. Replaces the vanilla `features/scroll-top.ts` glue.
export function ScrollTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let rafHandle = 0
    const update = () => {
      rafHandle = 0
      setShow(window.scrollY > 300)
    }
    const schedule = () => {
      if (rafHandle !== 0) return
      rafHandle = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      if (rafHandle !== 0) window.cancelAnimationFrame(rafHandle)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <li className={`fixed-gotop${show ? ' current' : ''}`}>
      <button
        type="button"
        aria-label="回到顶部"
        className="btn btn-light btn-icon btn-lg btn-rounded btn-gotop"
        onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
      >
        <span>
          <ArrowUpIcon />
        </span>
      </button>
    </li>
  )
}
