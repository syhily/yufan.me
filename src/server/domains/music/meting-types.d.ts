// Local typings for `@meting/core@1.6.x`. The package ships only ESM
// JavaScript with no `.d.ts`, and the README's signature claims do
// not match the actual runtime shape (some methods return JSON
// strings, others return objects depending on `format(true)`). The
// types below are calibrated to the netease provider exclusively;
// other providers (`tencent`, `kugou`, …) have different field names
// and packaging and are intentionally out of scope for this iteration.
//
// Probe summary (see `tmp/meting-probe.mjs` in dev):
//
//   const m = new Meting('netease'); m.format(true)
//   m.search(keyword, opts?) → JSON string of NeteaseFormattedSong[]
//   m.song(id)               → JSON string of NeteaseFormattedSong[] (single-item array)
//   m.url(urlId, br?)        → JSON string of { url, size, br }
//   m.lyric(lyricId)         → JSON string of { lyric, tlyric }
//   m.pic(picId, size?)      → JSON string of { url }
//
// The service layer at `@/server/domains/music/meting.ts` wraps the raw class,
// JSON.parses each call, and Zod-validates the result before handing it
// to business code, so any future drift in the upstream package surfaces
// as a clear runtime validation error instead of a silent type lie.

declare module '@meting/core' {
  export type MetingSource = 'netease'

  export type MetingSearchOptions = {
    type?: number
    page?: number
    limit?: number
  }

  export default class Meting {
    constructor(server: MetingSource)
    site(server: MetingSource): this
    cookie(cookie: string): this
    format(enable: boolean): this

    search(keyword: string, options?: MetingSearchOptions): Promise<string>
    song(id: number | string): Promise<string>
    url(id: number | string, bitrate?: number): Promise<string>
    lyric(id: number | string): Promise<string>
    pic(id: number | string, size?: number): Promise<string>
  }
}
