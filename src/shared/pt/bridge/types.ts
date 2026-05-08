export interface PmDoc {
  type: 'doc'
  content: PmNode[]
}

export type PmNode = PmBlockNode | PmInlineNode

export interface PmBlockNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
  marks?: PmMark[]
}

export interface PmInlineNode {
  type: 'text'
  text: string
  marks?: PmMark[]
}

export interface PmMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface PmListNode extends PmBlockNode {
  type: 'bulletList' | 'orderedList'
  content: PmNode[]
}
