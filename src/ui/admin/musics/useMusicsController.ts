import { useReducer } from 'react'

import type { AdminMusicDto } from '@/shared/music'

interface MusicsState {
  rows: AdminMusicDto[]
  total: number
  hasMore: boolean
  q: string
  /** Zero-based page index. */
  currentPage: number
  pageSize: number
}

type MusicsAction =
  | { type: 'loaded'; rows: AdminMusicDto[]; total: number; hasMore: boolean }
  | { type: 'setQ'; value: string }
  | { type: 'setCurrentPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'removeMusic'; id: string }
  | { type: 'prependMusic'; music: AdminMusicDto }
  | { type: 'patchMusic'; music: AdminMusicDto }

function musicsReducer(state: MusicsState, action: MusicsAction): MusicsState {
  switch (action.type) {
    case 'loaded':
      return { ...state, rows: action.rows, total: action.total, hasMore: action.hasMore }
    case 'setQ':
      return { ...state, q: action.value, currentPage: 0 }
    case 'setCurrentPage':
      return { ...state, currentPage: action.value }
    case 'setPageSize':
      return { ...state, pageSize: action.value, currentPage: 0 }
    case 'removeMusic':
      return {
        ...state,
        rows: state.rows.filter((row) => row.id !== action.id),
        total: Math.max(0, state.total - 1),
      }
    case 'prependMusic':
      return { ...state, rows: [action.music, ...state.rows], total: state.total + 1 }
    case 'patchMusic':
      return {
        ...state,
        rows: state.rows.map((row) => (row.id === action.music.id ? { ...row, ...action.music } : row)),
      }
  }
}

export function useMusicsController() {
  const [state, dispatch] = useReducer(musicsReducer, {
    rows: [],
    total: 0,
    hasMore: false,
    q: '',
    currentPage: 0,
    pageSize: 10,
  })
  return { state, dispatch }
}
