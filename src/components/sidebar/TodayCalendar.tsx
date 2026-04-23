import { DateTime } from 'luxon'

import config from '@/blog.config'
import { joinUrl } from '@/shared/urls'

function loadCalendarImage(): string {
  const now = DateTime.now().setZone(config.settings.timeZone).setLocale(config.settings.locale)
  return joinUrl(config.website, 'images/calendar', `${now.year}`, `${now.toFormat('LLdd')}.png`)
}

export function TodayCalendar() {
  if (!config.settings.sidebar.calendar) return null
  const calendarImage = loadCalendarImage()
  return (
    <div className="widget widget-owspace-calendar">
      <div className="widget-title" data-tippy-content="时光只解催人老，不信多情，长恨离亭。">
        时光只言
      </div>
      <img loading="lazy" decoding="async" src={calendarImage} width={600} height={880} />
    </div>
  )
}
