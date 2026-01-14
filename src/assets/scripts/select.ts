/**
 * 搜索下拉框组件
 */
class SearchableSelect {
  private selectElement: HTMLSelectElement
  private wrapper!: HTMLElement
  private button!: HTMLButtonElement
  private dropdown!: HTMLElement
  private searchInput!: HTMLInputElement
  private optionsList!: HTMLElement
  private selectedValue: string = ''
  private isOpen: boolean = false
  private options: Array<{ value: string, text: string, disabled?: boolean }> = []

  constructor(selectElement: HTMLSelectElement) {
    this.selectElement = selectElement
    this.selectedValue = selectElement.value

    // 从原始 select 中提取选项
    this.extractOptions()

    // 隐藏原始 select
    selectElement.style.display = 'none'

    // 创建新的 DOM 结构
    this.createDOM()

    // 绑定事件
    this.bindEvents()
  }

  private extractOptions(): void {
    this.options = Array.from(this.selectElement.options).map(option => ({
      value: option.value,
      text: option.text,
      disabled: option.disabled,
    }))
  }

  private createDOM(): void {
    // 创建包装器
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'searchable-select-wrapper'

    // 创建按钮
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'searchable-select form-select'
    this.button.setAttribute('aria-haspopup', 'listbox')
    this.button.setAttribute('aria-expanded', 'false')

    const selectedOption = this.options.find(o => o.value === this.selectedValue)
    const selectedText = selectedOption?.text || '请选择'
    this.button.innerHTML = `<span class="searchable-select-text">${this.escapeHtml(selectedText)}</span>`

    // 创建下拉框
    this.dropdown = document.createElement('div')
    this.dropdown.className = 'searchable-select-dropdown'

    // 创建搜索框
    const searchWrapper = document.createElement('div')
    searchWrapper.className = 'searchable-select-search'
    this.searchInput = document.createElement('input')
    this.searchInput.type = 'text'
    this.searchInput.placeholder = '搜索...'
    this.searchInput.setAttribute('autocomplete', 'off')
    searchWrapper.appendChild(this.searchInput)
    this.dropdown.appendChild(searchWrapper)

    // 创建选项列表
    this.optionsList = document.createElement('ul')
    this.optionsList.className = 'searchable-select-options'
    this.renderOptions()
    this.dropdown.appendChild(this.optionsList)

    // 组装
    this.wrapper.appendChild(this.button)
    this.wrapper.appendChild(this.dropdown)

    // 替换原始元素
    const parentNode = this.selectElement.parentNode
    if (parentNode) {
      parentNode.insertBefore(this.wrapper, this.selectElement)
    }
  }

  private renderOptions(filter: string = ''): void {
    this.optionsList.innerHTML = ''

    const filterLower = filter.toLowerCase()
    const filteredOptions = this.options.filter(
      option => !filter || option.text.toLowerCase().includes(filterLower),
    )

    if (filteredOptions.length === 0) {
      const emptyDiv = document.createElement('div')
      emptyDiv.className = 'searchable-select-empty'
      emptyDiv.textContent = '没有匹配的选项'
      this.optionsList.appendChild(emptyDiv)
      return
    }

    filteredOptions.forEach((option) => {
      const li = document.createElement('li')
      li.className = 'searchable-select-option'

      if (option.disabled) {
        li.classList.add('disabled')
      }

      if (option.value === this.selectedValue) {
        li.classList.add('selected')
      }

      li.textContent = option.text
      li.dataset.value = option.value

      if (!option.disabled) {
        li.addEventListener('click', () => this.selectOption(option.value))
      }

      this.optionsList.appendChild(li)
    })
  }

  private selectOption(value: string): void {
    this.selectedValue = value
    this.selectElement.value = value

    const selectedOption = this.options.find(o => o.value === value)
    const selectedText = selectedOption?.text || '请选择'
    const textSpan = this.button.querySelector('.searchable-select-text') as HTMLElement | null
    if (textSpan) {
      textSpan.textContent = selectedText
    }

    // 触发原始 select 的 change 事件
    const event = new Event('change', { bubbles: true })
    this.selectElement.dispatchEvent(event)

    this.close()
  }

  private open(): void {
    if (this.isOpen) {
      return
    }

    this.isOpen = true
    this.button.classList.add('open')
    this.dropdown.classList.add('open')
    this.button.setAttribute('aria-expanded', 'true')
    this.searchInput.focus()
  }

  private close(): void {
    if (!this.isOpen) {
      return
    }

    this.isOpen = false
    this.button.classList.remove('open')
    this.dropdown.classList.remove('open')
    this.button.setAttribute('aria-expanded', 'false')
    this.searchInput.value = ''
    this.renderOptions()
  }

  private bindEvents(): void {
    // 点击按钮打开/关闭下拉框
    this.button.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      this.isOpen ? this.close() : this.open()
    })

    // 搜索框输入
    this.searchInput.addEventListener('input', (e: Event) => {
      const filter = (e.target as HTMLInputElement).value
      this.renderOptions(filter)
    })

    // 点击下拉框外部关闭
    document.addEventListener('click', (e: MouseEvent) => {
      if (!this.wrapper.contains(e.target as Node)) {
        this.close()
      }
    })

    // 键盘导航
    this.button.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.isOpen ? this.close() : this.open()
      }
      else if (e.key === 'Escape') {
        this.close()
      }
    })
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // 公共方法：获取当前值
  getValue(): string {
    return this.selectedValue
  }

  // 公共方法：设置值
  setValue(value: string): void {
    const option = this.options.find(o => o.value === value)
    if (option) {
      this.selectOption(value)
    }
  }

  // 公共方法：销毁组件
  destroy(): void {
    this.wrapper.remove()
    this.selectElement.style.display = ''
  }
}

// 导出 SearchableSelect 类
export default SearchableSelect
