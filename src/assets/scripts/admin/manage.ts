import { actions } from 'astro:actions'

import type { AdminComment, FilterStatus } from '@/assets/scripts/admin/manage/types'

import { handleActionError, showErrorDialog } from '@/assets/scripts/actions'
import { bindCommentEvents, bindModalForms, setupModalClose } from '@/assets/scripts/admin/manage/modals'
import { renderPagination } from '@/assets/scripts/admin/manage/pagination'
import { renderCommentsList } from '@/assets/scripts/admin/manage/render-card'
import SearchableSelect from '@/assets/scripts/select'

const commentsContainer = document.getElementById('comments-container')!
const paginationContainer = document.getElementById('pagination-container')!
const refreshBtn = document.getElementById('refresh-btn')!
const filterStatusSelect = document.getElementById('filter-status') as HTMLSelectElement
const pageSizeSelect = document.getElementById('page-size') as HTMLSelectElement

const state = {
  currentPage: 0,
  pageSize: 10,
  filterStatus: 'all' as FilterStatus,
  filterPage: '',
  filterAuthor: '',
  totalComments: 0,
}

function showLoading(): void {
  commentsContainer.replaceChildren()
  const wrapper = document.createElement('div')
  wrapper.className = 'text-center py-5'
  const spinner = document.createElement('div')
  spinner.className = 'spinner-border text-primary'
  spinner.setAttribute('role', 'status')
  const sr = document.createElement('span')
  sr.className = 'visually-hidden'
  sr.textContent = '加载中...'
  spinner.appendChild(sr)
  wrapper.appendChild(spinner)
  commentsContainer.appendChild(wrapper)
}

async function loadComments(): Promise<void> {
  try {
    showLoading()

    const offset = state.currentPage * state.pageSize
    const { data, error } = await actions.comment.loadAll({
      offset,
      limit: state.pageSize,
      pageKey: state.filterPage || undefined,
      userId: state.filterAuthor || undefined,
    })

    if (error) return handleActionError(error)
    if (!data) return showErrorDialog('加载评论失败')

    const allComments = data.comments.map((c) => ({
      ...c,
      id: String(c.id),
      userId: String(c.userId),
      rootId: c.rootId ? String(c.rootId) : null,
      createAt: c.createAt instanceof Date ? c.createAt.toISOString() : String(c.createAt),
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
    })) as unknown as AdminComment[]

    state.totalComments = data.total

    let comments = allComments
    if (state.filterStatus === 'pending') comments = allComments.filter((c) => c.isPending)
    else if (state.filterStatus === 'approved') comments = allComments.filter((c) => !c.isPending)

    renderCommentsList(commentsContainer, comments)
    renderPagination(paginationContainer, {
      totalComments: state.totalComments,
      currentPage: state.currentPage,
      pageSize: state.pageSize,
      onChange: (page) => {
        state.currentPage = page
        void loadComments()
      },
    })

    bindCommentEvents(() => void loadComments())
  } catch (err) {
    console.error('加载评论失败:', err)
    showErrorDialog('加载评论失败，请刷新页面重试')
  }
}

async function initFilters(): Promise<void> {
  const { data, error } = await actions.comment.getFilterOptions({})
  if (error) {
    console.error('加载筛选选项失败:', error)
    return
  }
  if (!data) {
    console.error('无法获取筛选选项')
    return
  }

  const pageSelectEl = document.getElementById('filter-page') as HTMLSelectElement
  const authorSelectEl = document.getElementById('filter-author') as HTMLSelectElement

  for (const p of data.pages) {
    const option = document.createElement('option')
    option.value = p.key
    option.textContent = p.title || '无标题'
    pageSelectEl.appendChild(option)
  }
  for (const a of data.authors) {
    const option = document.createElement('option')
    option.value = String(a.id)
    option.textContent = a.name
    authorSelectEl.appendChild(option)
  }

  void new SearchableSelect(pageSelectEl)
  void new SearchableSelect(authorSelectEl)

  pageSelectEl.addEventListener('change', () => {
    state.filterPage = pageSelectEl.value
    state.currentPage = 0
    void loadComments()
  })
  authorSelectEl.addEventListener('change', () => {
    state.filterAuthor = authorSelectEl.value
    state.currentPage = 0
    void loadComments()
  })
}

refreshBtn.addEventListener('click', () => {
  state.currentPage = 0
  void loadComments()
})

filterStatusSelect.addEventListener('change', () => {
  state.filterStatus = filterStatusSelect.value as FilterStatus
  state.currentPage = 0
  void loadComments()
})

pageSizeSelect.addEventListener('change', () => {
  state.pageSize = Number.parseInt(pageSizeSelect.value, 10)
  state.currentPage = 0
  void loadComments()
})

setupModalClose()
bindModalForms(() => void loadComments())

void initFilters().then(() => loadComments())
