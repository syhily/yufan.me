import { postMdxComponents } from '@/ui/mdx/MdxContent'
import { MdxRemoteBody } from '@/ui/mdx/MdxRemoteBody'

export interface CommentBodyProps {
  /** Compiled JS function-body string produced by `compileMarkdown` for
   * the `comment` profile. `null` is allowed so callers can pipe through
   * the loader payload without an extra guard; nothing renders for empty
   * comment bodies — the surrounding chrome already shows a placeholder. */
  compiled: string | null | undefined
}

// Thin wrapper around `<MdxRemoteBody>` that wires in the same
// `postMdxComponents` map used by the post body. Comments and posts share
// the prose / footnote / table renderers so author-styled markup looks the
// same in both surfaces. The `comment` compile profile (see
// `@/server/markdown/runtime`) intentionally excludes the build-time-only
// passes (`rehypeImageEnhance`, `rehypeMermaid`, `rehypeTitleFigure`), so
// any `<MusicPlayer>`, `<Solution>`, `<Friends>`, or figure-promoted image
// authored in a comment renders as a no-op tag instead of the JSX
// component.
export function CommentBody({ compiled }: CommentBodyProps) {
  if (compiled === null || compiled === undefined || compiled === '') {
    return null
  }
  return <MdxRemoteBody compiled={compiled} components={postMdxComponents} />
}
