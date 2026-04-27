import type { MDXComponents } from 'mdx/types'

import { executeMdxSync } from '@fumadocs/mdx-remote/client'
import { memo, useMemo } from 'react'

// Shared SSR + client renderer for MDX bodies that were compiled at request
// time by `@/server/markdown/runtime.ts`. The server attaches the compiled
// JS function-body string to its loader payload; both this component (in
// SSR) and the React Router hydration path (on the client) re-execute the
// same string through `executeMdxSync` so the rendered output, the
// `MDXComponents` map, and the prop identity all match between the two
// passes.
//
// Memoised by `compiled` reference identity. The runtime LRU upstream
// returns the same `CompiledMarkdown` object for repeated sources, so
// repeated renders of the same comment skip the `Function` constructor
// round-trip and the inner React subtree avoids reconciliation churn.
export interface MdxRemoteBodyProps {
  compiled: string
  components?: MDXComponents
}

function MdxRemoteBodyImpl({ compiled, components }: MdxRemoteBodyProps) {
  const Body = useMemo(() => executeMdxSync(compiled).default, [compiled])
  return <Body components={components} />
}

export const MdxRemoteBody = memo(MdxRemoteBodyImpl)
