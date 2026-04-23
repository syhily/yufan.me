import { Icon } from '@/assets/icons/Icon'
import config from '@/blog.config'
import { Footer } from '@/components/partial/Footer'

export interface AdminCommentsPageProps {
  currentUserName: string
  currentUserEmail: string
}

export function AdminCommentsPage({ currentUserName, currentUserEmail }: AdminCommentsPageProps) {
  const bgImage = `${config.settings.asset.scheme}://${config.settings.asset.host}/images/admin/bg.jpg`
  return (
    <>
      <div className="row gx-0">
        <div className="col-lg-8 col-xl-8">
          <div className="post p-3 p-md-5">
            <div className="container-fluid py-4">
              <div className="row">
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h1 className="h3 mb-0">评论管理</h1>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-primary" id="refresh-btn">
                        <Icon name="refresh" /> 刷新
                      </button>
                    </div>
                  </div>

                  <div className="card mb-4">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">筛选状态</label>
                          <select className="form-select" id="filter-status">
                            <option value="all">全部</option>
                            <option value="pending">待审核</option>
                            <option value="approved">已审核</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">筛选文章</label>
                          <select className="form-select" id="filter-page">
                            <option value="">全部文章</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">筛选评论人员</label>
                          <select className="form-select" id="filter-author">
                            <option value="">全部人员</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">每页显示</label>
                          <select className="form-select" id="page-size" defaultValue="10">
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
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">加载中...</span>
                      </div>
                    </div>
                  </div>

                  <div id="pagination-container" className="mt-4" />
                </div>
              </div>
            </div>
          </div>
          <Footer />
        </div>
        <div className="col-lg-4 col-xl-4 d-none d-lg-block sticky-top hv">
          <div className="bg-img hv" style={{ backgroundImage: `url('${bgImage}')` }} />
        </div>
      </div>

      <div className="nice-popup" id="edit-comment-modal">
        <div className="nice-popup-overlay" />
        <div className="nice-popup-body">
          <div className="nice-popup-content">
            <h6>编辑评论</h6>
            <form id="edit-comment-form">
              <input type="hidden" id="edit-comment-id" />
              <div className="mb-3">
                <label className="form-label">评论内容</label>
                <textarea className="form-control" id="edit-comment-content" rows={8} required />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
                <button type="button" className="btn btn-secondary close-modal-btn">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="nice-popup" id="edit-user-modal">
        <div className="nice-popup-overlay" />
        <div className="nice-popup-body">
          <div className="nice-popup-content">
            <h6>编辑用户信息</h6>
            <form id="edit-user-form">
              <input type="hidden" id="edit-user-id" />
              <div className="mb-3">
                <label className="form-label">用户名</label>
                <input type="text" className="form-control" id="edit-user-name" required />
              </div>
              <div className="mb-3">
                <label className="form-label">邮箱</label>
                <input type="email" className="form-control" id="edit-user-email" required />
              </div>
              <div className="mb-3">
                <label className="form-label">网站链接</label>
                <input type="url" className="form-control" id="edit-user-link" />
              </div>
              <div className="mb-3">
                <label className="form-label">徽章名称</label>
                <input type="text" className="form-control" id="edit-user-badge-name" />
              </div>
              <div className="mb-3">
                <label className="form-label">徽章颜色</label>
                <input type="color" className="form-control form-control-color" id="edit-user-badge-color" />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
                <button type="button" className="btn btn-secondary close-modal-btn">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="nice-popup" id="reply-comment-modal">
        <div className="nice-popup-overlay" />
        <div className="nice-popup-body">
          <div className="nice-popup-content">
            <h6>回复评论</h6>
            <form id="reply-comment-form">
              <input type="hidden" id="reply-comment-id" />
              <input type="hidden" id="reply-page-key" />
              <div className="mb-3">
                <label className="form-label">回复内容</label>
                <textarea className="form-control" id="reply-comment-content" rows={8} required />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-primary">
                  发送回复
                </button>
                <button type="button" className="btn btn-secondary close-modal-btn">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <input type="hidden" id="admin-user-name" data-value={currentUserName} />
      <input type="hidden" id="admin-user-email" data-value={currentUserEmail} />
    </>
  )
}
