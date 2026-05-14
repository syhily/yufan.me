import { isbot } from 'isbot'
import { createHash } from 'node:crypto'
import { UAParser } from 'ua-parser-js'

import type { EnrichedAccessEvent, RawAccessEvent } from '@/server/analytics/types'

import { lookupCity } from '@/server/analytics/geoip'
import { getDailySalt } from '@/server/analytics/salt'

// Take a raw request signal and produce a row-shaped event ready for
// the COPY pipeline. Pure async work — never touches the request /
// response objects after this returns. All failures degrade to null
// fields rather than throwing.

function hashIp(ip: string): string {
  // SHA-256 truncated to 32 hex chars. 128 bits of state in a 32-byte
  // text column is still well below the SHA-256 collision floor at
  // the data volumes a personal blog produces, and the visitor table
  // index is materially smaller than a full 64-char hash.
  return createHash('sha256')
    .update(ip + getDailySalt())
    .digest('hex')
    .slice(0, 32)
}

function parseRefererHost(referer: string | null): string | null {
  if (!referer) {
    return null
  }
  try {
    return new URL(referer).host || null
  } catch {
    return null
  }
}

// Minimal `Accept-Language` first-tag parser. The header is
// comma-separated quality-weighted tags
// (`zh-CN,zh;q=0.9,en;q=0.8`). The dashboard only cares about the
// primary preference, so first tag wins. Empty / malformed input
// returns `null` — same null-degrade behaviour as every other
// enrichment column. Dropping the `intl-parse-accept-language` dep
// (the plan's original choice) saves ~25KB of runtime for what is
// effectively `split(',')[0]`.
function parsePrimaryLanguage(header: string | null): string | null {
  if (!header) {
    return null
  }
  const first = header.split(',')[0]?.split(';')[0]?.trim()
  return first ? first : null
}

// Treat the visit as a bot if either the `isbot` heuristic flags it
// (mature regex against ~6000 known bots) OR the UA parser classifies
// it as a crawler/spider/fetcher. The UA-parser bucket catches
// some self-identified bots that `isbot`'s allow-list misses on
// older releases. Sink applies the same belt-and-suspenders
// (see `server/utils/access-log.ts:117-125`).
function isBotUa(ua: string, uaResult: ReturnType<UAParser['getResult']>): boolean {
  if (!ua) {
    return false
  }
  if (isbot(ua)) {
    return true
  }
  const browserType = uaResult.browser.type
  if (browserType && ['crawler', 'fetcher', 'spider', 'bot'].includes(browserType)) {
    return true
  }
  return false
}

export async function enrichEvent(raw: RawAccessEvent): Promise<EnrichedAccessEvent> {
  const ua = raw.ua ?? ''
  const uaResult = new UAParser(ua).getResult()
  const language = parsePrimaryLanguage(raw.acceptLanguage)
  const geo = raw.ip ? await lookupCity(raw.ip) : null

  const country = geo?.country?.isoCode ?? geo?.registeredCountry?.isoCode ?? null
  const region = geo?.subdivisions?.[0]?.names?.en ?? null
  const city = geo?.city?.names?.en ?? null
  const latitude = geo?.location?.latitude ?? null
  const longitude = geo?.location?.longitude ?? null
  const timezone = geo?.location?.timeZone ?? null

  return {
    ts: raw.ts,
    visitorHash: hashIp(raw.ip),
    sessionId: raw.sessionId,
    ip: raw.ip || null,
    path: raw.path,
    entityType: raw.target?.type ?? null,
    entityId: raw.target?.ownerId ?? null,
    referer: raw.referer,
    refererHost: parseRefererHost(raw.referer),
    country,
    region,
    city,
    latitude,
    longitude,
    timezone,
    language,
    ua: ua || null,
    browser: uaResult.browser.name ?? null,
    browserVersion: uaResult.browser.version ?? null,
    os: uaResult.os.name ?? null,
    osVersion: uaResult.os.version ?? null,
    device: uaResult.device.model ?? null,
    deviceType: uaResult.device.type ?? null,
    isBot: isBotUa(ua, uaResult),
  }
}
