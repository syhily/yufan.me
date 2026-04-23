import type { ReactNode } from 'react'

export interface UnstyledSolutionProps {
  children?: ReactNode
}

export function UnstyledSolution({ children }: UnstyledSolutionProps) {
  return <blockquote>{children}</blockquote>
}
