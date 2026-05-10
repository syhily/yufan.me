import { useReducer } from 'react'

import type { AdminPageDto } from '@/shared/cms-pages'

interface PagesState {
  rows: AdminPageDto[]
  total: number
  q: string
  deletedStatus: 'all' | 'deleted' | 'normal'
}

type PagesAction =
  | { type: 'loaded'; rows: AdminPageDto[]; total: number }
  | { type: 'setQ'; value: string }
  | { type: 'setDeletedStatus'; value: 'all' | 'deleted' | 'normal' }
  | { type: 'patchPage'; page: AdminPageDto }
  | { type: 'removePage'; id: string }
  | { type: 'prependPage'; page: AdminPageDto }

function pagesReducer(state: PagesState, action: PagesAction): PagesState {
  switch (action.type) {
    case 'loaded':
      return { ...state, rows: action.rows, total: action.total }
    case 'setQ':
      return { ...state, q: action.value }
    case 'setDeletedStatus':
      return { ...state, deletedStatus: action.value }
    case 'patchPage':
      return {
        ...state,
        rows: state.rows.map((row) => (row.id === action.page.id ? { ...row, ...action.page } : row)),
      }
    case 'removePage':
      return {
        ...state,
        rows: state.rows.filter((row) => row.id !== action.id),
        total: Math.max(0, state.total - 1),
      }
    case 'prependPage':
      return { ...state, rows: [action.page, ...state.rows], total: state.total + 1 }
  }
}

export function usePagesController() {
  const [state, dispatch] = useReducer(pagesReducer, {
    rows: [],
    total: 0,
    q: '',
    deletedStatus: 'normal',
  })
  return { state, dispatch }
}

export type PagesControllerDispatch = ReturnType<typeof usePagesController>['dispatch']
