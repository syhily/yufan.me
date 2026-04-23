import type { FilterStatus } from '@/assets/scripts/admin/manage/types'

import { bindCommentEvents, bindModalForms, setupModalClose } from '@/assets/scripts/admin/manage/modals'
import { renderPagination } from '@/assets/scripts/admin/manage/pagination'
import { actions, handleActionError, showErrorDialog } from '@/assets/scripts/shared/actions'
import SearchableSelect from '@/assets/scripts/shared/select'

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
      status: state.filterStatus,
    })

    if (error) return handleActionError(error)
    if (!data) return showErrorDialog('加载评论失败')

    state.totalComments = data.total

    // The server has already rendered the cards as safe HTML through the
    // shared <AdminCommentCard /> Astro component, so we just swap it in.
    commentsContainer.innerHTML = data.html

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
