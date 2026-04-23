import config from '@/blog.config'

export function SearchBar() {
  return (
    <div id="search" className="widget widget-search" hidden={!config.settings.sidebar.search}>
      <div className="search-form">
        <label>
          <span className="screen-reader-text">文章寻踪</span>
          <input type="search" className="search-field search-sidebar" placeholder="文章寻踪（输入后回车）" name="q" />
        </label>
      </div>
    </div>
  )
}
