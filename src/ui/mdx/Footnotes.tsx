import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react'

import { FOOTNOTE_SUP_CLASSES, Li, SupLink } from '@/ui/mdx/prose'
import { Tooltip } from '@/ui/primitives/Tooltip'

interface FootnoteContextValue {
  previews: ReadonlyMap<string, ReactNode>
}

type FootnoteRegister = (href: string, preview: ReactNode) => () => void

interface FootnoteElementProps {
  children?: ReactNode
  className?: string
  href?: string
  id?: string
  dataFootnoteBackref?: boolean
  'data-footnote-backref'?: boolean
}

const FootnotePreviewContext = createContext<FootnoteContextValue | null>(null)
const FootnoteRegisterContext = createContext<FootnoteRegister | null>(null)
const FOOTNOTE_ID_PREFIX = 'user-content-fn-'
const FOOTNOTE_REF_ID_PREFIX = 'user-content-fnref-'

export function FootnoteProvider({ children }: { children: ReactNode }) {
  const [previews, setPreviews] = useState<ReadonlyMap<string, ReactNode>>(() => new Map())
  const register = useCallback((href: string, preview: ReactNode) => {
    setPreviews((current) => {
      const next = new Map(current)
      next.set(href, preview)
      return next
    })
    return () => {
      setPreviews((current) => {
        if (!current.has(href)) return current
        const next = new Map(current)
        next.delete(href)
        return next
      })
    }
  }, [])

  const value = useMemo(() => ({ previews }), [previews])
  return (
    <FootnoteRegisterContext.Provider value={register}>
      <FootnotePreviewContext.Provider value={value}>{children}</FootnotePreviewContext.Provider>
    </FootnoteRegisterContext.Provider>
  )
}

export function FootnoteReference({ children, className, ...props }: ComponentProps<'sup'>) {
  const context = useContext(FootnotePreviewContext)
  const href = footnoteReferenceHref(children)
  const preview = href === undefined ? undefined : context?.previews.get(href)

  if (preview === undefined) {
    return (
      <SupLink className={className} {...props}>
        {children}
      </SupLink>
    )
  }
  return (
    <Tooltip placement="top">
      <Tooltip.Trigger as="sup" className={[FOOTNOTE_SUP_CLASSES, className].filter(Boolean).join(' ')} {...props}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content>{preview}</Tooltip.Content>
    </Tooltip>
  )
}

export function FootnoteDefinition({ children, id, ...props }: ComponentProps<'li'>) {
  const register = useContext(FootnoteRegisterContext)
  const isFootnote = typeof id === 'string' && id.startsWith(FOOTNOTE_ID_PREFIX)
  const preview = useMemo(() => stripBackrefs(children), [children])
  const previewRef = useRef(preview)
  previewRef.current = preview

  useEffect(() => {
    if (!isFootnote || register === null || typeof id !== 'string') return
    return register(`#${id}`, previewRef.current)
  }, [id, isFootnote, register])

  return (
    <Li {...props} id={id}>
      {children}
    </Li>
  )
}

function footnoteReferenceHref(node: ReactNode): string | undefined {
  if (node === null || node === undefined || typeof node === 'boolean') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const href = footnoteReferenceHref(child)
      if (href !== undefined) return href
    }
    return undefined
  }
  if (!isValidElement<FootnoteElementProps>(node)) return undefined

  const { href, id, children } = node.props
  if (
    typeof href === 'string' &&
    href.startsWith('#user-content-fn-') &&
    typeof id === 'string' &&
    id.startsWith(FOOTNOTE_REF_ID_PREFIX)
  ) {
    return href
  }
  return footnoteReferenceHref(children)
}

function stripBackrefs(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return node
  if (Array.isArray(node)) return node.map(stripBackrefs).filter((child) => child !== null)
  if (!isValidElement<FootnoteElementProps>(node)) return node
  if (isBackref(node.props)) return null

  const children = stripBackrefs(node.props.children)
  return cloneElement(node as ReactElement<FootnoteElementProps>, undefined, children)
}

function isBackref(props: FootnoteElementProps): boolean {
  return (
    props.dataFootnoteBackref === true ||
    props['data-footnote-backref'] === true ||
    props.className?.split(/\s+/).includes('data-footnote-backref') === true
  )
}
