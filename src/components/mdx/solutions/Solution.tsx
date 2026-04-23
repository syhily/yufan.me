import type { ReactNode } from 'react'

export interface SolutionProps {
  children?: ReactNode
}

export function Solution({ children }: SolutionProps) {
  return (
    <blockquote className="solution">
      <div className="solution-begin">解：</div>
      {children}
      <div className="solution-qed">□</div>
    </blockquote>
  )
}
