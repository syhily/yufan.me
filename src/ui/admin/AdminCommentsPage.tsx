import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type {
  CommentEditOutput,
  CommentRawOutput,
  FilterOptionsOutput,
  LoadAllOutput,
  ReplyCommentOutput,
} from '@/client/api/action-types'
import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { idStr } from '@/shared/tools'
import { AdminCommentList } from '@/ui/admin/AdminCommentList'
import { AdminCommentsPagination } from '@/ui/admin/AdminCommentsPagination'
import { RefreshIcon } from '@/ui/icons/icons'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

type FilterStatus = 'all' | 'pending' | 'approved'

interface PageState {
  comments: AdminComment[]
  total: number
  hasMore: boolean
  currentPage: number
  pageSize: number
  filterStatus: FilterStatus
  filterPage: string
  filterAuthor: string
}

type PageAction =
  | { type: 'loaded'; comments: AdminComment[]; total: number; hasMore: boolean }
  | { type: 'removeComment'; id: string }
  | { type: 'approveComment'; id: string }
  | { type: 'updateComment'; comment: AdminComment }
  | { type: 'setFilterStatus'; value: FilterStatus }
  | { type: 'setFilterPage'; value: string }
  | { type: 'setFilterAuthor'; value: string }
  | { type: 'setPageSize'; value: number }
  | { type: 'setCurrentPage'; value: number }

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'loaded':
      return { ...state, comments: action.comments, total: action.total, hasMore: action.hasMore }
    case 'removeComment':
      return {
        ...state,
        comments: state.comments.filter((c) => idStr(c.id) !== action.id),
      }
    case 'approveComment':
      return {
        ...state,
        comments: state.comments.map((c) => (idStr(c.id) === action.id ? { ...c, isPending: false } : c)),
      }
    case 'updateComment':
      return {
        ...state,
        comments: state.comments.map((c) =>
          idStr(c.id) === idStr(action.comment.id) ? { ...c, ...action.comment } : c,
        ),
      }
    case 'setFilterStatus':
      return { ...state, filterStatus: action.value, currentPage: 0 }
    case 'setFilterPage':
      return { ...state, filterPage: action.value, currentPage: 0 }
    case 'setFilterAuthor':
      return { ...state, filterAuthor: action.value, currentPage: 0 }
    case 'setPageSize':
      return { ...state, pageSize: action.value, currentPage: 0 }
    case 'setCurrentPage':
      return { ...state, currentPage: action.value }
  }
}

const LOAD_ALL = API_ACTIONS.comment.loadAll
const FILTER_OPTS = API_ACTIONS.comment.getFilterOptions
const EDIT = API_ACTIONS.comment.edit
const REPLY = API_ACTIONS.comment.replyComment
const GET_RAW = API_ACTIONS.comment.getRaw
const UPDATE_USER = API_ACTIONS.auth.updateUser

export interface AdminCommentsPageProps {
  currentUserName: string
  currentUserEmail: string
}

export function AdminCommentsPage({ currentUserName, currentUserEmail }: AdminCommentsPageProps) {
  const [state, dispatch] = useReducer(reducer, {
    comments: [],
    total: 0,
    hasMore: false,
    currentPage: 0,
    pageSize: 10,
    filterStatus: 'all',
    filterPage: '',
    filterAuthor: '',
  })

  const loadFetcher = useFetcher<ApiEnvelope<LoadAllOutput>>()
  const optionsFetcher = useFetcher<ApiEnvelope<FilterOptionsOutput>>()

  const [editTarget, setEditTarget] = useState<AdminComment | null>(null)
  const [replyTarget, setReplyTarget] = useState<AdminComment | null>(null)
  const [editUserTarget, setEditUserTarget] = useState<AdminComment | null>(null)

  const reload = useCallback(() => {
    const offset = state.currentPage * state.pageSize
    void loadFetcher.submit(
      {
        offset,
        limit: state.pageSize,
        ...(state.filterPage ? { pageKey: state.filterPage } : {}),
        ...(state.filterAuthor ? { userId: state.filterAuthor } : {}),
        ...(state.filterStatus !== 'all' ? { status: state.filterStatus } : {}),
      },
      { method: LOAD_ALL.method, encType: 'application/json', action: LOAD_ALL.path },
    )
  }, [loadFetcher, state.currentPage, state.pageSize, state.filterPage, state.filterAuthor, state.filterStatus])

  useEffect(() => {
    void optionsFetcher.load(FILTER_OPTS.path)
  }, [optionsFetcher])

  useEffect(() => {
    reload()
  }, [reload])

  const lastLoadHandled = useRef<unknown>(null)
  useEffect(() => {
    if (loadFetcher.state !== 'idle' || !loadFetcher.data) return
    if (loadFetcher.data === lastLoadHandled.current) return
    lastLoadHandled.current = loadFetcher.data
    if (loadFetcher.data.error) {
      console.error('[admin] load failed', loadFetcher.data.error)
      return
    }
    const payload = loadFetcher.data.data
    if (!payload) return
    dispatch({
      type: 'loaded',
      comments: payload.comments,
      total: payload.total,
      hasMore: payload.hasMore,
    })
  }, [loadFetcher.state, loadFetcher.data])

  const filterOptions = optionsFetcher.data?.data ?? { pages: [], authors: [] }

  const totalPages = useMemo(() => Math.ceil(state.total / state.pageSize), [state.total, state.pageSize])

  const onRowEdit = (comment: AdminComment) => setEditTarget(comment)
  const onRowReply = (comment: AdminComment) => setReplyTarget(comment)
  const onRowEditUser = (comment: AdminComment) => setEditUserTarget(comment)

  return (
    <>
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h1 className="h3 mb-0">评论管理</h1>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-primary" onClick={reload}>
                  <RefreshIcon /> 刷新
                </button>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="filter-status">
                      筛选状态
                    </label>
                    <select
                      className="form-select"
                      id="filter-status"
                      value={state.filterStatus}
                      onChange={(e) =>
                        dispatch({
                          type: 'setFilterStatus',
                          value: e.target.value as FilterStatus,
                        })
                      }
                    >
                      <option value="all">全部</option>
                      <option value="pending">待审核</option>
                      <option value="approved">已审核</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="filter-page">
                      筛选文章
                    </label>
                    <select
                      className="form-select"
                      id="filter-page"
                      value={state.filterPage}
                      onChange={(e) => dispatch({ type: 'setFilterPage', value: e.target.value })}
                    >
                      <option value="">全部文章</option>
                      {filterOptions.pages.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.title || '无标题'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="filter-author">
                      筛选评论人员
                    </label>
                    <select
                      className="form-select"
                      id="filter-author"
                      value={state.filterAuthor}
                      onChange={(e) => dispatch({ type: 'setFilterAuthor', value: e.target.value })}
                    >
                      <option value="">全部人员</option>
                      {filterOptions.authors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="page-size">
                      每页显示
                    </label>
                    <select
                      className="form-select"
                      id="page-size"
                      value={state.pageSize}
                      onChange={(e) =>
                        dispatch({
                          type: 'setPageSize',
                          value: Number.parseInt(e.target.value, 10),
                        })
                      }
                    >
                      <option value="10">10 条</option>
                      <option value="20">20 条</option>
                      <option value="50">50 条</option>
                      <option value="100">100 条</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div id="comments-container">
              {loadFetcher.state !== 'idle' ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">加载中...</span>
                  </div>
                </div>
              ) : (
                <AdminCommentList
                  comments={state.comments}
                  onEditComment={onRowEdit}
                  onReplyComment={onRowReply}
                  onEditUser={onRowEditUser}
                  onApproved={(id) => dispatch({ type: 'approveComment', id: idStr(id) })}
                  onDeleted={(id) => dispatch({ type: 'removeComment', id: idStr(id) })}
                />
              )}
            </div>

            <div id="pagination-container" className="mt-4">
              <AdminCommentsPagination
                totalPages={totalPages}
                currentPage={state.currentPage}
                onChange={(page) => dispatch({ type: 'setCurrentPage', value: page })}
              />
            </div>
          </div>
        </div>
      </div>

      {editTarget && (
        <EditCommentModal
          comment={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(c) => {
            dispatch({ type: 'updateComment', comment: { ...editTarget, ...c } })
            setEditTarget(null)
          }}
        />
      )}
      {editUserTarget && (
        <EditUserModal
          comment={editUserTarget}
          onClose={() => setEditUserTarget(null)}
          onSaved={() => {
            setEditUserTarget(null)
            reload()
          }}
        />
      )}
      {replyTarget && (
        <ReplyCommentModal
          comment={replyTarget}
          authorName={currentUserName || '管理员'}
          authorEmail={currentUserEmail}
          onClose={() => setReplyTarget(null)}
          onReplied={() => {
            setReplyTarget(null)
            reload()
          }}
        />
      )}
    </>
  )
}

interface ModalProps {
  title: string
  children: React.ReactNode
  onClose: () => void
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="nice-popup nice-popup-open">
      <div className="nice-popup-overlay" onClick={onClose} />
      <div className="nice-popup-body">
        <div className="nice-popup-content">
          <h6>{title}</h6>
          {children}
        </div>
      </div>
    </div>
  )
}

interface EditCommentModalProps {
  comment: AdminComment
  onClose: () => void
  onSaved: (comment: { content: string }) => void
}

function EditCommentModal({ comment, onClose, onSaved }: EditCommentModalProps) {
  const rawFetcher = useFetcher<ApiEnvelope<CommentRawOutput>>()
  const editFetcher = useFetcher<ApiEnvelope<CommentEditOutput>>()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void rawFetcher.load(`${GET_RAW.path}?rid=${encodeURIComponent(idStr(comment.id))}`)
  }, [rawFetcher, comment.id])

  useEffect(() => {
    if (rawFetcher.state !== 'idle' || !rawFetcher.data || loaded) return
    if (rawFetcher.data.data) {
      setValue(rawFetcher.data.data.content || '')
      setLoaded(true)
    }
  }, [rawFetcher.state, rawFetcher.data, loaded])

  useEffect(() => {
    if (editFetcher.state !== 'idle' || !editFetcher.data) return
    if (editFetcher.data.error) {
      console.error('[admin] edit failed', editFetcher.data.error)
      return
    }
    if (editFetcher.data.data) onSaved({ content: editFetcher.data.data.comment.content ?? '' })
  }, [editFetcher.state, editFetcher.data, onSaved])

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value.trim()) {
      window.alert('评论内容不能为空')
      return
    }
    void editFetcher.submit(
      { rid: idStr(comment.id), content: value },
      { method: EDIT.method, encType: 'application/json', action: EDIT.path },
    )
  }

  return (
    <Modal title="编辑评论" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-comment-content">
            评论内容
          </label>
          <textarea
            id="edit-comment-content"
            className="form-control"
            rows={8}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!loaded || editFetcher.state !== 'idle'}
            required
          />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="submit" className="btn btn-primary" disabled={editFetcher.state !== 'idle' || !loaded}>
            保存
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface EditUserModalProps {
  comment: AdminComment
  onClose: () => void
  onSaved: () => void
}

function EditUserModal({ comment, onClose, onSaved }: EditUserModalProps) {
  const fetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const [name, setName] = useState(comment.name)
  const [email, setEmail] = useState(comment.email)
  const [link, setLink] = useState(comment.link ?? '')
  const [badgeName, setBadgeName] = useState(comment.badgeName ?? '')
  const [badgeColor, setBadgeColor] = useState(comment.badgeColor ?? '#008c95')

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data.error) {
      console.error('[admin] update user failed', fetcher.data.error)
      return
    }
    onSaved()
  }, [fetcher.state, fetcher.data, onSaved])

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const payload: Record<string, string> = { userId: idStr(comment.userId), name, email }
    if (link) payload.link = link
    if (badgeName) payload.badgeName = badgeName
    if (badgeColor) payload.badgeColor = badgeColor
    void fetcher.submit(payload, {
      method: UPDATE_USER.method,
      encType: 'application/json',
      action: UPDATE_USER.path,
    })
  }

  return (
    <Modal title="编辑用户信息" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-user-name">
            用户名
          </label>
          <input
            id="edit-user-name"
            type="text"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-user-email">
            邮箱
          </label>
          <input
            id="edit-user-email"
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-user-link">
            网站链接
          </label>
          <input
            id="edit-user-link"
            type="url"
            className="form-control"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-user-badge-name">
            徽章名称
          </label>
          <input
            id="edit-user-badge-name"
            type="text"
            className="form-control"
            value={badgeName}
            onChange={(e) => setBadgeName(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="edit-user-badge-color">
            徽章颜色
          </label>
          <input
            id="edit-user-badge-color"
            type="color"
            className="form-control form-control-color"
            value={badgeColor}
            onChange={(e) => setBadgeColor(e.target.value)}
          />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="submit" className="btn btn-primary" disabled={fetcher.state !== 'idle'}>
            保存
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ReplyCommentModalProps {
  comment: AdminComment
  authorName: string
  authorEmail: string
  onClose: () => void
  onReplied: () => void
}

function ReplyCommentModal({ comment, authorName, authorEmail, onClose, onReplied }: ReplyCommentModalProps) {
  const fetcher = useFetcher<ApiEnvelope<ReplyCommentOutput>>()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data.error) {
      console.error('[admin] reply failed', fetcher.data.error)
      return
    }
    onReplied()
  }, [fetcher.state, fetcher.data, onReplied])

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value.trim()) {
      window.alert('回复内容不能为空')
      return
    }
    if (!authorEmail) {
      window.alert('无法获取用户邮箱，请刷新页面重试')
      return
    }
    void fetcher.submit(
      {
        page_key: comment.pageKey,
        name: authorName,
        email: authorEmail,
        content: value,
        rid: Number.parseInt(idStr(comment.id), 10),
      },
      { method: REPLY.method, encType: 'application/json', action: REPLY.path },
    )
  }

  return (
    <Modal title="回复评论" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="reply-comment-content">
            回复内容
          </label>
          <textarea
            id="reply-comment-content"
            className="form-control"
            rows={8}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="submit" className="btn btn-primary" disabled={fetcher.state !== 'idle'}>
            发送回复
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  )
}
