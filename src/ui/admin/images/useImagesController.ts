import { useReducer } from 'react'

import type { AdminImageDto, AdminImageKind } from '@/shared/images'

interface ImagesState {
  rows: AdminImageDto[]
  total: number
  hasMore: boolean
  q: string
  kind: AdminImageKind | 'all'
  /** Zero-based page index. */
  currentPage: number
  pageSize: number
}

type ImagesAction =
  | { type: 'loaded'; rows: AdminImageDto[]; total: number; hasMore: boolean }
  | { type: 'setQ'; value: string }
  | { type: 'setKind'; value: AdminImageKind | 'all' }
  | { type: 'setCurrentPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'patchImage'; image: AdminImageDto }
  | { type: 'removeImage'; id: string }
  | { type: 'prependImage'; image: AdminImageDto }

function imagesReducer(state: ImagesState, action: ImagesAction): ImagesState {
  switch (action.type) {
    case 'loaded':
      return { ...state, rows: action.rows, total: action.total, hasMore: action.hasMore }
    case 'setQ':
      return { ...state, q: action.value, currentPage: 0 }
    case 'setKind':
      return { ...state, kind: action.value, currentPage: 0 }
    case 'setCurrentPage':
      return { ...state, currentPage: action.value }
    case 'setPageSize':
      return { ...state, pageSize: action.value, currentPage: 0 }
    case 'patchImage':
      return {
        ...state,
        rows: state.rows.map((row) => (row.id === action.image.id ? { ...row, ...action.image } : row)),
      }
    case 'removeImage':
      return {
        ...state,
        rows: state.rows.filter((row) => row.id !== action.id),
        total: Math.max(0, state.total - 1),
      }
    case 'prependImage':
      return { ...state, rows: [action.image, ...state.rows], total: state.total + 1 }
  }
}

export function useImagesController() {
  const [state, dispatch] = useReducer(imagesReducer, {
    rows: [],
    total: 0,
    hasMore: false,
    q: '',
    kind: 'all',
    currentPage: 0,
    pageSize: 60,
  })
  return { state, dispatch }
}
