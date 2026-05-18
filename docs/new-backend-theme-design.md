# Admin Dashboard 视觉重构计划（修正版）

> **目标**：以 Ghost Admin (Shade Design System) 为设计基准，对 `/admin` 后台进行系统性视觉升级。
>
> **策略**：
> 1. 彻底拆分 Admin 与 Public 的 CSS 主题层
> 2. 将 Ghost Shade 的设计 Token 映射到项目现有 Token 体系
> 3. 从 Ghost Shade 复制组件样式，但保留项目的 Base UI 组件 API
> 4. 提取 `post-content` / `comment-content` 为跨层公共组件
>
> **Ghost 参考目录**：`/Users/Yufan/Downloads/Ghost/apps/shade/`
>
> **关键 Token 文件**：
> - Ghost 语义变量：`apps/shade/theme-variables.css`（HSL 格式，`--background`、`--sidebar-*` 等）
> - Ghost 静态 Token：`apps/shade/tailwind.theme.css`（`--color-grey-*`、`--shadow-*`、`--radius-*` 等）
> - 项目现有 Token：`src/assets/styles/tailwind.css` `:root` 块 + `@theme inline` 块

---

## 一、设计决策（已确认）

| 决策 | 结论 | 理由 |
|---|---|---|
| Sidebar 亮色模式颜色 | **浅色**（Ghost 原始设计） | Ghost 在亮色模式下 sidebar 为 `hsl(240 11% 98%)`，暗色模式才为深色 |
| Primitives（Box/Stack 等） | **跳过** | Ghost UI 组件内部不依赖 primitives；项目用 Tailwind 类名可达到一致视觉 |
| Ghost Token 策略 | **映射到现有 Token** | 避免引入 50+ 新变量。在 `admin-theme.css` 中 `--focus-ring: var(--ring)` 等 |
| `--radius` 变更 | Admin 侧改为 `0.5rem` | 在 `admin-theme.css` 中覆盖 `--radius`，不影响 Public 的 `0.3125rem` |
| Button API | **保留 `useRender`** | 项目用 Base UI `useRender` + `render` prop，Ghost 用 Radix `Slot` + `asChild`，两者不兼容。保留项目 API，仅更新样式 |

---

## 二、Ghost Token → 项目 Token 映射表

Ghost Shade 组件引用的额外 Token，需在 `admin-theme.css` 中映射到项目已有变量。以下为预先审计的映射：

| Ghost Token | 映射到项目 Token | 说明 |
|---|---|---|
| `--control-height` | `34px`（新值） | Ghost Button 的默认高度 |
| `--focus-ring` | `var(--ring)` | focus ring 颜色 |
| `--surface-elevated` | `var(--card)` | 浮层面板背景 |
| `--surface-panel` | `var(--card)` | 面板背景 |
| `--surface-page` | `var(--background)` | 页面背景 |
| `--surface-overlay` | `var(--popover)` | 覆盖层背景 |
| `--surface-inverse` | `var(--foreground)` | 反色表面 |
| `--text-primary` | `var(--foreground)` | 主文本 |
| `--text-secondary` | `var(--muted-foreground)` | 次文本 |
| `--text-tertiary` | `var(--muted-foreground)` | 三级文本 |
| `--text-inverse` | `var(--primary-foreground)` | 反色文本 |
| `--border-subtle` | `var(--input)` | 弱边框 |
| `--border-default` | `var(--border)` | 默认边框 |
| `--border-strong` | `var(--line-widget)` | 强边框 |
| `--state-info` | `var(--brand)` | 信息状态 |
| `--state-success` | `#30cf43` | 成功状态（Ghost 绿） |
| `--state-warning` | `var(--warn)` | 警告状态 |
| `--state-danger` | `var(--destructive)` | 危险状态 |
| `--shadow` | Ghost 原值 | 基础阴影 |
| `--shadow-sm` | Ghost 原值 | 小阴影 |
| `--shadow-md` | Ghost 原值 | 中阴影 |
| `--shadow-lg` | Ghost 原值 | 大阴影 |
| `--shadow-xl` | Ghost 原值 | 超大阴影 |
| `--input-group-radius` | `9px`（新值） | Input 组圆角 |
| `--mobile-navbar-height` | `64px`（新值） | 移动端导航高度 |

> **Phase 0 实施时**：用 `grep -rn "var(--" /path/to/Ghost/shade/components/ui/*.tsx` 扫描所有待复制组件，生成精确的引用列表，与上表对照补充遗漏。

---

## 三、Tailwind CSS 架构拆分：Admin / Public 主题隔离

### 3.1 目标架构

```
src/assets/styles/
├── tailwind.css              ← 纯语法层（零颜色值）
│   ├── @import 'tailwindcss' source(none)
│   ├── @plugin '@tailwindcss/typography'
│   ├── @custom-variant dark { ... }
│   ├── @source '../..'
│   ├── @theme inline { ... }     ← 注册变量映射（含 Ghost 映射），如 --color-focus-ring: var(--focus-ring)
│   ├── @layer base { ...reset... }
│   ├── html { font-family... }   ← 无 background-color / color
│   ├── @import './cursors.css'
│   ├── @utility prose-blog {     ← 仅保留 &.prose 部分（Typography 插件覆盖）
│   │     &.prose { ... }
│   │   }
│   ├── @keyframes shake, comment-flash, comments-shimmer
│   └── (无 post-content / comment-content)
│
├── public-theme.css          ← Public 专属颜色值 + body 背景/文字色
│   ├── :root { --background: ...; --foreground: ...; ... }
│   ├── .dark { ... }
│   ├── @media (prefers-color-scheme: dark) { :root:not(.light,.dark) { ... } }
│   ├── .dark pre.shiki { ... }
│   └── html, body { background-color: var(--surface-body); color: var(--ink-2); }
│
├── admin-theme.css           ← Admin 专属颜色值（Ghost Shade 风格）
│   ├── :root[data-admin-theme] { ... shadcn slots + Ghost Token 映射 ... }
│   ├── :root[data-admin-theme].dark { ... }
│   └── html[data-admin-theme] body { background-color: var(--background); color: var(--foreground); }
│
├── prose-content.css         ← post-content + comment-content（公共内容层）
│   ├── @utility post-content { ... }
│   ├── @utility comment-content { ... }
│   └── @layer utilities { /* 表格样式 */ }
│   （⚠️ 不含 @import 'tailwindcss'）
│
├── aplayer.css               ← 现有，不动
├── cursors.css               ← 现有，不动
├── public.css                ← Public 入口
│   └── @import './tailwind.css'; @import './public-theme.css'; @import './prose-content.css';
└── admin.css                 ← Admin 入口
    ├── @layer base, components, utilities;
    ├── .medium-zoom-overlay, .medium-zoom-image--opened { z-index: 1080; }
    └── @import './tailwind.css'; @import './admin-theme.css'; @import './prose-content.css';
```

### 3.2 Admin Theme Token（`admin-theme.css`）

```css
/* src/assets/styles/admin-theme.css */

:root[data-admin-theme] {
  /* Ghost Shade shadcn slot aliases — HSL format matching Ghost */
  --background: hsl(0 0% 100%);
  --foreground: hsl(216 11% 9%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(216 11% 9%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(216 11% 9%);
  --primary: hsl(216 11% 9%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(204 14% 93%);
  --secondary-foreground: hsl(216 11% 9%);
  --muted: hsl(200 12% 96%);
  --muted-foreground: hsl(210 13% 55%);
  --accent: hsl(200 12% 96%);
  --accent-foreground: hsl(216 11% 9%);
  --destructive: hsl(354 92% 50%);
  --destructive-foreground: hsl(0 0% 100%);
  --border: hsl(204 15% 91%);
  --input: hsl(204 14% 93%);
  --ring: hsl(215 13% 63%);
  --radius: 0.5rem;

  /* Ghost Sidebar — 浅色模式 sidebar（跟随 Ghost 原始设计） */
  --sidebar-background: hsl(240 11% 98%);
  --sidebar-foreground: hsl(216 11% 9%);
  --sidebar-primary: hsl(216 11% 9%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(204 14% 93%);
  --sidebar-accent-foreground: hsl(216 11% 9%);
  --sidebar-border: hsl(200 12% 96%);
  --sidebar-ring: hsl(215 13% 63%);

  /* Ghost Token → 项目 Token 映射（第二章映射表） */
  --control-height: 34px;
  --focus-ring: var(--ring);
  --surface-elevated: var(--card);
  --surface-panel: var(--card);
  --surface-page: var(--background);
  --surface-overlay: var(--popover);
  --surface-inverse: var(--foreground);
  --text-primary: var(--foreground);
  --text-secondary: var(--muted-foreground);
  --text-tertiary: var(--muted-foreground);
  --text-inverse: var(--primary-foreground);
  --border-subtle: var(--input);
  --border-default: var(--border);
  --border-strong: hsl(210 13% 79%);
  --state-info: hsl(198 100% 51%);
  --state-success: hsl(144 100% 39%);
  --state-warning: hsl(47 100% 50%);
  --state-danger: var(--destructive);
  --input-group-radius: 9px;
  --mobile-navbar-height: 64px;

  /* Ghost Shade shadows */
  --shadow: 0 0 1px rgba(0,0,0,.05), 0 5px 18px rgba(0,0,0,.08);
  --shadow-sm: 0 0 1px rgba(0,0,0,.12), 0 1px 6px rgba(0,0,0,.03), 0 8px 10px -8px rgba(0,0,0,.1);
  --shadow-md: 0 0 1px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,.03), 0 8px 10px -8px rgba(0,0,0,0.05), 0 24px 37px -21px rgba(0,0,0,0.05);
  --shadow-lg: 0 0 7px rgba(0,0,0,0.08), 0 2.1px 2.2px -5px rgba(0,0,0,0.011), 0 5.1px 5.3px -5px rgba(0,0,0,0.016), 0 9.5px 10px -5px rgba(0,0,0,0.02), 0 17px 17.9px -5px rgba(0,0,0,0.024), 0 31.8px 33.4px -5px rgba(0,0,0,0.029), 0 76px 80px -5px rgba(0,0,0,0.04);
  --shadow-xl: 0 2.8px 2.2px rgba(0,0,0,0.02), 0 6.7px 5.3px rgba(0,0,0,0.028), 0 12.5px 10px rgba(0,0,0,0.035), 0 22.3px 17.9px rgba(0,0,0,0.042), 0 41.8px 33.4px rgba(0,0,0,0.05), 0 100px 80px rgba(0,0,0,0.07);
}

:root[data-admin-theme].dark {
  --background: hsl(216 11% 9%);
  --foreground: hsl(210 13% 88%);
  --card: hsl(216 11% 9%);
  --card-foreground: hsl(213 31% 91%);
  --popover: hsl(216 11% 9%);
  --popover-foreground: hsl(212 13% 72%);
  --primary: hsl(200 12% 96%);
  --primary-foreground: hsl(216 11% 9%);
  --secondary: hsl(210 11% 25%);
  --secondary-foreground: hsl(200 12% 96%);
  --muted: hsl(210 11% 25%);
  --muted-foreground: hsl(210 13% 63%);
  --accent: hsl(210 11% 25%);
  --accent-foreground: hsl(200 12% 96%);
  --destructive: hsl(354 81% 31%);
  --destructive-foreground: hsl(240 11% 98%);
  --border: hsl(216 7% 14%);
  --input: hsl(210 11% 25%);
  --ring: hsl(210 11% 25%);

  --sidebar-background: hsl(216 11% 6%);
  --sidebar-foreground: hsl(200 12% 96%);
  --sidebar-primary: hsl(210 11% 25%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(210 11% 17%);
  --sidebar-accent-foreground: hsl(200 12% 96%);
  --sidebar-border: hsl(210 11% 15%);
  --sidebar-ring: hsl(210 13% 55%);

  --border-strong: hsl(210 13% 55%);
  --surface-elevated: hsl(210 11% 12%);
}

html[data-admin-theme] body {
  background-color: var(--background);
  color: var(--foreground);
}
```

### 3.3 运行时主题切换机制

使用 `<html data-admin-theme>` 属性作为 Admin token 的 CSS 选择器。

**SSR + CSR 切换**：在 `root.tsx` 的 `Layout` 组件中读取 `useLocation()`，动态设置/移除属性：

```tsx
// src/root.tsx — Layout 组件改动
import { useLocation } from 'react-router'

function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<{
    theme?: 'dark' | 'light' | null
    blogSettings?: { fonts?: { globalCss?: string[] } | null } | null
  }>('root')
  const theme = rootData?.theme ?? null
  const globalFontCss = rootData?.blogSettings?.fonts?.globalCss ?? []
  const location = useLocation()
  const isAdminRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/signin')

  return (
    <html
      lang="zh-CN"
      className={theme ?? undefined}
      data-admin-theme={isAdminRoute ? '' : undefined}
    >
      {/* ... 其余不变 ... */}
    </html>
  )
}
```

**行为验证**：
- SSR `/admin` → `<html data-admin-theme>` → admin token 生效 ✅
- CSR → `/admin` → `useLocation()` 更新 → `<html data-admin-theme>` → admin token 生效 ✅
- CSR → `/` → `<html>` 无属性 → public token 生效 ✅
- `useDetachPublicCss()` 继续工作，admin.css 和 public.css 互不干扰 ✅

### 3.4 `@theme inline` 新增映射

在 `tailwind.css` 的 `@theme inline` 块中追加 Ghost Token 映射行：

```css
@theme inline {
  /* ... 保留所有现有映射 ... */

  /* Ghost Shade Token 映射 */
  --color-focus-ring: var(--focus-ring);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-panel: var(--surface-panel);
  --color-surface-page: var(--surface-page);
  --color-surface-overlay: var(--surface-overlay);
  --color-surface-inverse: var(--surface-inverse);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-inverse: var(--text-inverse);
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-state-info: var(--state-info);
  --color-state-success: var(--state-success);
  --color-state-warning: var(--state-warning);
  --color-state-danger: var(--state-danger);
  --shadow-default: var(--shadow);
  --shadow-ghost-sm: var(--shadow-sm);
  --shadow-ghost-md: var(--shadow-md);
  --shadow-ghost-lg: var(--shadow-lg);
  --shadow-ghost-xl: var(--shadow-xl);
  --spacing-control-height: var(--control-height);
}
```

**`cn.ts` 同步更新**：在对应列表中注册新增 Token 名。

---

## 四、`post-content` / `comment-content` 提取为公共组件

### 4.1 CSS 层

将 `post-content` 和 `comment-content` 从 `@utility prose-blog` 提取为独立 `@utility`：

```css
/* src/assets/styles/prose-content.css */
/* ⚠️ 不含 @import 'tailwindcss' */

@utility post-content {
  --prose-blog-table-border: color-mix(in oklab, var(--line-muted) 78%, var(--ink-4) 22%);
  --prose-blog-table-header-bg: var(--surface);
  --prose-blog-table-stripe: color-mix(in oklab, var(--surface-soft) 55%, var(--canvas) 45%);

  &.prose-blog.prose { /* 原 tailwind.css 中 &.post-content 的全部内容 */ }
}

@utility comment-content {
  &.prose-blog.prose { /* 原 tailwind.css 中 &.comment-content 的全部内容 */ }
}

/* 表格样式 — 从原 tailwind.css @layer utilities 迁移 */
@layer utilities {
  .post-content.prose-blog.prose table.pt-table { ... }
  /* ... 完整迁移 ... */
}
```

### 4.2 组件层

```tsx
// src/ui/pt/PostContent.tsx
import { cn } from '@/ui/lib/cn'

export const POST_CONTENT_BASE_CLASSES = 'post-content prose-blog prose prose-lg max-w-none'

interface PostContentProps {
  children: React.ReactNode
  className?: string
  ref?: React.Ref<HTMLDivElement>
}

export function PostContent({ children, className, ref }: PostContentProps) {
  return (
    <div ref={ref} className={cn(POST_CONTENT_BASE_CLASSES, className)}>
      {children}
    </div>
  )
}

// src/ui/pt/CommentContent.tsx
export const COMMENT_CONTENT_BASE_CLASSES = 'comment-content prose-blog prose prose-sm max-w-none'

interface CommentContentProps {
  children: React.ReactNode
  className?: string
}

export function CommentContent({ children, className }: CommentContentProps) {
  return (
    <div className={cn(COMMENT_CONTENT_BASE_CLASSES, className)}>
      {children}
    </div>
  )
}
```

### 4.3 替换范围

| 文件 | 原代码 | 替换为 |
|---|---|---|
| `ui/public/post/DetailBodyChrome.tsx` | `<div className="post-content prose-blog prose prose-lg max-w-none">` | `<PostContent ref={ref}>` |
| `ui/admin/editor-shell/PreviewPanel.tsx` | `<div ref={ref} className="post-content prose-blog prose prose-lg max-w-none">` | `<PostContent ref={ref}>` |
| `ui/admin/editor/PageBodyEditor.tsx` | `'post-content pt-body-editor prose-blog ...'` | 使用 `POST_CONTENT_BASE_CLASSES` 常量 |
| `ui/public/comments/comment-item/helpers.ts` | `cn('comment-content', 'prose-blog prose prose-sm ...')` | `COMMENT_CONTENT_BASE_CLASSES` |
| `ui/admin/users/UserDetailView.tsx` | `<div className="comment-content prose-blog prose ...">` | `<CommentContent>` |
| `ui/admin/my/MyCommentsView.tsx` | `<div className="comment-content prose-blog my-2 prose ...">` | `<CommentContent>` |
| `ui/admin/comments/AdminCommentRow.tsx` | `<div className="comment-content prose-blog my-2 prose ...">` | `<CommentContent>` |

---

## 五、Ghost Shade 组件复用清单

### 5.1 通用迁移规则

每个从 Ghost Shade 复制/借鉴的组件都需要以下处理：

1. **Import 路径**：`@/lib/utils` → `@/ui/lib/cn`
2. **`forwardRef` → prop ref**：`React.forwardRef<T, P>((props, ref) => ...)` → `function Comp({ ref, ...props }: P & { ref?: React.Ref<T> }) { ... }`
3. **`SHADE_APP_NAMESPACES` 移除**：所有 Portal 组件（Dialog、Sheet、DropdownMenu、Select、Popover、AlertDialog）中移除 `<div className={SHADE_APP_NAMESPACES}>` wrapper。CSS 变量会从 `<html data-admin-theme>` 继承到 body 下的 Portal content。
4. **`inputSurface()` 内联**：不引入 Ghost 的 `input-surface.ts`，将样式逻辑直接写在组件中，使用项目映射后的 Token 名。

### 5.2 ★★★★★ 直接复制（样式替换）

| Ghost 源文件 | 项目目标 | 说明 |
|---|---|---|
| `badge.tsx` | `src/ui/components/badge.tsx` | 直接替换样式 |
| `card.tsx` | `src/ui/components/card.tsx` | 直接替换样式 |
| `avatar.tsx` | `src/ui/components/avatar.tsx` | 直接替换样式 |
| `separator.tsx` | `src/ui/components/separator.tsx` | 直接替换样式 |
| `skeleton.tsx` | `src/ui/components/skeleton.tsx` | 直接替换样式 |
| `label.tsx` | `src/ui/components/label.tsx` | 直接替换样式 |
| `sonner.tsx` | `src/ui/components/sonner.tsx` | Toast 样式对齐 |
| `accordion.tsx` | `src/ui/components/accordion.tsx` | 新增 |
| `tabs.tsx` | `src/ui/components/tabs.tsx` | 替换 |
| `checkbox.tsx` | `src/ui/components/checkbox.tsx` | 替换 |
| `switch.tsx` | `src/ui/components/switch.tsx` | 替换 |
| `radio-group.tsx` | `src/ui/components/radio-group.tsx` | 替换 |
| `calendar.tsx` | `src/ui/components/calendar.tsx` | 替换 |
| `tooltip.tsx` | `src/ui/components/tooltip.tsx` | 替换 |

### 5.3 ★★★★☆ 样式替换 + API 保留

| Ghost 源文件 | 项目目标 | 说明 |
|---|---|---|
| `button.tsx` | `src/ui/components/button.tsx` | **保留 `useRender` + `render` prop API**，仅更新 `buttonVariants` 样式。保留 `destructive-soft`/`fab`/`light`/`dark`/`shape`/`block` variants。新增 Ghost 的 `dropdown` variant |
| `input.tsx` | `src/ui/components/input.tsx` | 不引入 `inputSurface()`，内联映射后的样式 |
| `textarea.tsx` | `src/ui/components/textarea.tsx` | 同 Input |
| `table.tsx` | `src/ui/components/table.tsx` | 检查 API 兼容性后替换样式 |

### 5.4 ★★★★☆ 复制 + 移除 `SHADE_APP_NAMESPACES`

| Ghost 源文件 | 项目目标 | 说明 |
|---|---|---|
| `dialog.tsx` | `src/ui/components/dialog.tsx` | 移除 SHADE_APP_NAMESPACES wrapper |
| `sheet.tsx` | `src/ui/components/sheet.tsx` | 移除 SHADE_APP_NAMESPACES wrapper |
| `dropdown-menu.tsx` | `src/ui/components/dropdown-menu.tsx` | 移除 SHADE_APP_NAMESPACES wrapper |
| `select.tsx` | `src/ui/components/select.tsx` | 移除 SHADE_APP_NAMESPACES + 内联 inputSurface |
| `popover.tsx` | `src/ui/components/popover.tsx` | 移除 SHADE_APP_NAMESPACES wrapper |
| `alert-dialog.tsx` | `src/ui/components/alert-dialog.tsx` | 新增，移除 SHADE_APP_NAMESPACES |

### 5.5 ★★★☆☆ 参考实现（代码重写）

| Ghost 源文件 | 说明 |
|---|---|
| `sidebar.tsx` (773 LOC) | 太重（含 cookie 状态/快捷键/rail/tooltip）。精简为项目专用版本（200-300 LOC），保留核心导航结构 |

### 5.6 不复用（项目专用）

- `empty.tsx` — 项目自定义空状态
- `combobox.tsx` — 项目自定义 searchable dropdown
- `field.tsx` — 项目基于 Base UI 的版本
- `editor/` 下所有 Tiptap 组件
- `ui/pt/` 下 PortableText 渲染器
- `ui/public/` 下所有 public 组件

---

## 六、视觉一致性：与 Ghost Admin 形似

### 6.1 Ghost Admin 布局解剖

Ghost Admin 的视觉结构分为三层（基于 `apps/shade/` 组件 + `apps/admin-x-settings/` 页面分析）：

```
┌─────────────────────────────────────────────────────┐
│ .gh-app (flex col, h-100vh, overflow-hidden)        │
│ ┌───────────────────────────────────────────────────┐│
│ │ .gh-viewport (flex, flex-grow, overflow-hidden)   ││
│ │ ┌──────────┐ ┌──────────────────────────────────┐ ││
│ │ │ Sidebar  │ │ .gh-main (flex col, flex-grow)    │ ││
│ │ │ (shade)  │ │ ┌──────────────────────────────┐ │ ││
│ │ │          │ │ │ Canvas Header (sticky)        │ │ ││
│ │ │ Logo     │ │ │   Title (2.8rem, bold)       │ │ ││
│ │ │ ──────── │ │ │   View Actions (filters, btn)│ │ ││
│ │ │ Nav × N  │ │ ├──────────────────────────────┤ │ ││
│ │ │          │ │ │ Canvas Body (scrollable)      │ │ ││
│ │ │          │ │ │   max-width: 1400px           │ │ ││
│ │ │          │ │ │   padding: 0 4vw 4vw          │ │ ││
│ │ │ ──────── │ │ │                                │ │ ││
│ │ │ UserMenu │ │ │                                │ │ ││
│ │ └──────────┘ └──────────────────────────────────┘ ││
│ └───────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 6.2 关键视觉要素

以下要素决定 Ghost Admin 的"形"，每个都需要精确复现：

#### 页面标题

- 字号：`2.8rem`（~44.8px），Ghost 使用 `--text-3xl`
- 字重：`700`
- 字间距：`-0.02em`
- 行高：`1.25em`
- 颜色：`var(--black)` / `var(--foreground)`

```tsx
// 所有列表页标题统一
<h1 className="text-[2.8rem] font-bold tracking-[-0.02em] leading-tight text-foreground">
  Posts
</h1>
```

#### 内容区最大宽度

- Ghost 使用 `--main-layout-content-maxwidth`，标准页面 `~1400px`，宽页面 `1600px`
- 内容水平 padding：`var(--main-layout-content-sidepadding)` ≈ `4vw`（桌面端约 `40px`）

```tsx
<div className="mx-auto w-full max-w-[1400px] px-[4vw]">
```

#### Canvas Header（粘性标题栏）

- 粘性定位（sticky top）
- 背景色：`var(--background)`
- 底部边框：`1px solid transparent`（滚动时可能显示）
- 标题和操作按钮水平排列，`justify-between`
- Ghost 的 filter/toolbar 区域有特定间距：`gap-8px`

#### 列表项

Ghost 列表页的标准模式：
- 标题栏 + filter 按钮 + primary action 按钮（如 "New post"）
- 列表项使用 `gh-expandable` 卡片（bordered card with sections）
- 每个列表项：左侧内容 + 右侧状态/操作

#### Sidebar

Shade 的 Sidebar 组件（`apps/shade/src/components/ui/sidebar.tsx`）:
- 宽度：约 `240px`（桌面端）
- 背景：浅色模式 `hsl(240 11% 98%)`，暗色模式 `hsl(216 11% 6%)`
- Logo 在顶部
- Nav item：`rounded-md px-3 py-2 text-sm font-medium`
- Active item：`bg-sidebar-accent`
- 用户头像区在底部
- 无顶部 header——sidebar 自身就是全局导航

#### 全局排版

- 字体：Inter（Ghost 使用 `--font-sans: Inter, ...`）
- 基础字号：`1.4rem`（Ghost 使用 rem）
- 行高：`1.5em`
- 按钮：`h-9`（Ghost 的 `--control-height: 34px`），圆角 `rounded-md`
- 输入框：统一 `h-9`，focus 绿色 ring

### 6.3 Ghost vs 项目视觉差异表

| 要素 | Ghost Admin | 项目当前 | 需调整 |
|---|---|---|---|
| Sidebar 位置 | 左侧固定，无顶部 header | 左侧 aside + 顶部 header | **移除顶部 header** |
| Sidebar 宽度 | ~240px | `w-60`（240px） | ✅ 一致 |
| Sidebar 亮色 | 近白 `hsl(240 11% 98%)` | `--surface` = `#f6f6f7` | 需更新为 Ghost 色 |
| 页面标题字号 | `2.8rem` | 无统一标准 | **新增 Ghost 尺度** |
| 内容区 max-width | `~1400px` | `max-w-7xl`（1280px） | 改为 `max-w-[1400px]` |
| 按钮 control height | `34px` | `h-10`（40px） | 改为 `h-[34px]` |
| 输入框高度 | `34px` | `h-9`（36px） | 改为 `h-[34px]` |
| 按钮/输入圆角 | `rounded-md`（Ghost `--radius: 0.4rem`） | `rounded-md`（`0.3125rem`） | Admin 侧用 `0.4rem` |
| Focus ring | 绿色 `#30cf43` / `25% opacity` | `--ring` / `50% opacity` | 更新为 Ghost 绿 |
| 卡片间距 | `margin-bottom: 12px` | `gap-6`（24px） | 调整 |
| 列表项分隔 | `border-b` 或 bordered card | 不统一 | 统一为 bordered card |

### 6.4 形似实施要点

**AdminShell 重写**（Module D）：

```
┌───────────┬──────────────────────────────────────────┐
│ Sidebar   │ Main Content Area                        │
│ w-[240px] │ ┌──────────────────────────────────────┐ │
│           │ │ Canvas Header (sticky)                │ │
│ ┌───────┐ │ │  Title (2.8rem)    [Filter] [Action] │ │
│ │ Logo  │ │ ├──────────────────────────────────────┤ │
│ ├───────┤ │ │                                      │ │
│ │ Nav ×N│ │ │  Content (scrollable)                │ │
│ │       │ │ │  max-w-[1400px] mx-auto px-[4vw]     │ │
│ │       │ │ │                                      │ │
│ │       │ │ │                                      │ │
│ ├───────┤ │ └──────────────────────────────────────┘ │
│ │User   │ │                                          │
│ └───────┘ │                                          │
└───────────┴──────────────────────────────────────────┘
```

- **无顶部 header**——sidebar 包含 Logo 和全局操作（ThemeToggle、UserMenu、BackToSite）
- **内容区独立滚动**——`overflow-y-auto` 在 main 上，不在 sidebar 上
- **Focus mode**——sidebar 隐藏，内容区全宽

**列表页统一结构**（Module G）：

```tsx
// 标准列表页模板
<section>
  {/* Canvas Header */}
  <div className="sticky top-0 z-10 border-b bg-background px-[4vw] py-6">
    <div className="mx-auto flex max-w-[1400px] items-center justify-between">
      <h1 className="text-[2.8rem] font-bold tracking-[-0.02em]">Posts</h1>
      <div className="flex items-center gap-2">
        {/* Filters */}
        {/* Primary Action Button */}
      </div>
    </div>
  </div>
  {/* Canvas Body */}
  <div className="mx-auto max-w-[1400px] px-[4vw] pb-8">
    {/* List content */}
  </div>
</section>
```

**设置页全屏覆盖层**（Module H，第六章）：

---

## 七、Settings 页面重构：全屏覆盖层 + 连续滚动

### 6.1 设计目标

将 Settings 从 "侧边栏导航 + 14 个独立页面" 改为 Ghost Admin 风格的**全屏覆盖层**：

- 点击 Sidebar 的 "系统设置" → 打开全屏 settings overlay
- **左侧**：搜索框 + 分组导航（带滚动定位）
- **右侧**：连续滚动的设置内容区，所有 14 个 section 纵向排列
- **右上角**：Done / 关闭按钮
- ESC 键关闭（带未保存提示）

### 6.2 Ghost 参考实现

Ghost 的 settings 在 `apps/admin-x-settings/` 中，核心结构：

```
main-content.tsx
├── Page (fixed fullscreen overlay)
│   ├── ExitSettingsButton (右上角 Done)
│   ├── Sidebar (左侧：搜索 + 分组 nav)
│   │   ├── 搜索框 (TextField, "/" 快捷键聚焦)
│   │   └── SettingNavSection × N (分组 + SettingNavItem)
│   └── Settings (右侧：连续滚动)
│       └── GeneralSettings → SiteSettings → MembershipSettings → ...
```

关键设计：
1. **搜索过滤**：输入关键词，不匹配的 nav item 隐藏，右侧只显示匹配的 section
2. **滚动联动**：点击左侧 nav → 右侧滚动到对应 section；右侧滚动 → 左侧高亮跟随
3. **分组**：nav 按 "General settings" / "Site" / "Advanced" 等分组
4. **全屏沉浸**：fixed 定位覆盖整个 viewport，不与 admin sidebar 共存

### 6.3 项目适配方案

**路由变更**：

```
当前：/admin/settings/:section → 每个 section 一个页面
目标：/admin/settings → 全屏 overlay（单一路由）
```

保留 `routes/admin/settings/layout.tsx` 作为 settings 的入口，但不再为每个 section 创建独立路由。14 个 section 的内容全部内联到一个滚动页面中。

**组件结构**：

```
src/ui/admin/settings/
├── SettingsOverlay.tsx          ← 全屏 overlay 容器
│   ├── ExitSettingsButton
│   ├── SettingsSidebar.tsx      ← 搜索 + 分组导航
│   │   ├── 搜索框
│   │   └── SectionNav × 4-5 分组
│   └── SettingsContent.tsx      ← 右侧连续滚动内容
│       ├── GeneralForm
│       ├── NavigationEditor
│       ├── SocialsEditor
│       ├── ContentForm
│       ├── SidebarForm
│       ├── CommentsForm
│       ├── SeoForm
│       ├── MailForm
│       ├── AssetsForm
│       ├── SearchForm
│       ├── FontsForm
│       ├── ThresholdForm
│       ├── LimitsForm
│       └── CacheView + BackupView
├── SettingsSection.tsx          ← 每个区块的卡片容器
├── SettingsFormBar.tsx          ← 保存/重置操作栏（保留）
├── useSettingsFetcher.ts        ← 保留
├── useSettingsForm.ts           ← 保留
└── *Form.tsx                    ← 各 section 的表单内容（保留）
```

**交互行为**：
1. Sidebar 中点击 "系统设置" → 全屏 overlay 打开（可以用 `<Dialog>` 或直接 fixed 定位）
2. 左侧搜索框实时过滤 section
3. 左侧 nav 点击 → 右侧 `scrollIntoView` 对应 section
4. 右侧滚动 → 通过 `IntersectionObserver` 高亮左侧对应 nav item
5. 每个 section 内的保存/重置逻辑不变（仍然独立 per-section 保存）
6. Done 按钮或 ESC 关闭 overlay → 返回 admin 主界面

**移动端**：
- 左侧 sidebar 隐藏，改为顶部搜索 + 汉堡菜单（Sheet）
- 右侧内容区全宽

**路由保留**：考虑到 SEO 和直接链接需求，可以保留 `/admin/settings/:section` 路由但改为打开 overlay 后自动滚动到对应 section。或者简化为单一 `/admin/settings` 路由。

### 6.4 实施要点

- **删除** `routes/admin/settings/{general,navigation,...}.tsx`（14 个独立页面路由）→ 合并为 `routes/admin/settings/index.tsx`
- **重写** `SettingsShell.tsx` → `SettingsOverlay.tsx`
- **新增** `SettingsSidebar.tsx`（搜索 + 分组 nav + 滚动联动）
- **新增** `SettingsContent.tsx`（连续滚动容器）
- **保留** 所有 `*Form.tsx` 的内部逻辑不变，只调整外层容器和间距
- **删除** `SettingsRow.tsx`（Ghost 风格不需要两列 label/control 布局）

---

## 八、可并行执行的执行计划

### Phase 0: Token 审计（串行，无代码变更）

**目标**：生成精确的 Token 映射表。

1. `grep -rn "var(--" /path/to/Ghost/shade/components/ui/*.tsx` 扫描所有待复制组件
2. 与项目 `tailwind.css` `:root` 块交叉对比
3. 验证第二章映射表的完整性，补充遗漏
4. 输出最终映射表

**预计产出**：25-30 个映射条目（第二章已列出大部分）。

### Phase 1a: CSS 架构拆分（Module A，串行）

**依赖**：Phase 0

**任务清单**：
1. 创建 `src/assets/styles/public-theme.css`：从 `tailwind.css` 移出 `:root` / `.dark` / `@media prefers-color-scheme` 块 + `html,body` 背景色
2. 创建 `src/assets/styles/admin-theme.css`：第三章 3.2 节的完整内容
3. 创建 `src/assets/styles/prose-content.css`：第四章 4.1 节的完整内容（不含 `@import 'tailwindcss'`）
4. 重写 `src/assets/styles/tailwind.css`：移出颜色值和内容样式，新增 Ghost Token 映射行
5. 更新 `src/assets/styles/public.css`：三个 import
6. 更新 `src/assets/styles/admin.css`：保留 medium-zoom 样式 + 三个 import
7. 更新 `src/ui/lib/cn.ts`：注册所有新增 Token
8. 更新 `src/root.tsx` Layout：`data-admin-theme` 切换

**验证**：`vp check` + `vp build` + Public 视觉无回归 + Admin 新 token 生效 + `tests/contract.tailwind-tokens.test.ts` 通过

### Phase 1b: 基础组件迁移（Module B + C + E，并行）

**依赖**：Phase 1a 完成

#### Module B: Core UI Components

- Button：保留 `useRender` + `render` prop，仅更新 `buttonVariants`
- Badge / Card / Avatar / Separator / Skeleton / Label / Sonner：直接复制样式

#### Module C: Overlays & Forms

- Dialog / Sheet / DropdownMenu / Select / Popover / AlertDialog：移除 `SHADE_APP_NAMESPACES`
- Input / Textarea / Select：内联 `inputSurface()` 逻辑，使用映射后的 Token
- Accordion / Tabs / Checkbox / Switch / RadioGroup / Calendar / Tooltip：直接复制

#### Module E: PostContent / CommentContent 提取

- 创建 `PostContent.tsx` / `CommentContent.tsx`
- 替换所有 7 个使用处

### Phase 1c: Sidebar 重写（Module D）

**依赖**：Module B + C

- 参考 Ghost `sidebar.tsx` 精简重写（200-300 LOC）
- 亮色模式浅色 sidebar（`--sidebar-background: hsl(240 11% 98%)`）
- 保留 `AdminChromeContext`
- 移动端 Sheet drawer

### Phase 2: 页面层重构（Module F-J，并行）

**依赖**：Phase 1 全部完成

| Module | 范围 |
|---|---|
| F: Login & Auth | signin + install wizard |
| G: List Views | 所有 admin 列表页 |
| H: Settings | **全屏覆盖层重构**（第六章），SettingsOverlay + SettingsSidebar + SettingsContent + 14 个 *Form.tsx 间距适配 |
| I: Dashboard & My | Welcome + My + Analytics + UserDetail |
| J: Editor | Editor shell + Tiptap 组件 |

**Module H 详解**：
1. 创建 `SettingsOverlay.tsx` — 全屏 fixed 定位容器 + ESC 关闭
2. 创建 `SettingsSidebar.tsx` — 搜索框 + 分组导航（参考 Ghost `sidebar.tsx` 搜索/过滤逻辑）
3. 创建 `SettingsContent.tsx` — 连续滚动，纵向排列所有 14 个 section
4. 实现滚动联动：点击 nav → `scrollIntoView`；`IntersectionObserver` → 高亮 nav
5. 将 14 个 `routes/admin/settings/*.tsx` 路由合并为单一 `routes/admin/settings/index.tsx`
6. 更新 AdminShell 中 "系统设置" 导航项，点击时打开 overlay
7. 适配 `*Form.tsx` 的外层容器/间距，适配新 `SettingsSection` 卡片样式
8. 移动端：隐藏 sidebar，改为顶部搜索 + Sheet drawer |

### Phase 3: 收尾（Module K，串行）

- 全局搜索替换（逐个审查）
- Public 回归检查
- `vp check` + `vp test` + `vp build`
- License（`licenses/LICENSE.ghost-shade.txt`）
- README.md / AGENTS.md 更新

---

## 九、依赖图

```
Phase 0（串行）
└── Token 审计与映射表
    │
Phase 1a（串行）
└── Module A: CSS 架构拆分
    │
Phase 1b（并行）
├── Module B: Core UI
├── Module C: Overlays & Forms
└── Module E: Content 提取
    │
Phase 1c（串行）
└── Module D: Sidebar（依赖 B + C）
    │
Phase 2（并行）
├── Module F: Login & Auth
├── Module G: List Views
├── Module H: Settings 全屏覆盖层（第六章）
├── Module I: Dashboard & My
└── Module J: Editor
    │
Phase 3（串行）
└── Module K: Polish & Docs
```

---

## 十、验收标准

- [ ] **CSS 拆分**：`tailwind.css` 无 `:root` 颜色值、`public-theme.css` 和 `admin-theme.css` 独立存在
- [ ] **主题切换**：public → admin → public，颜色正确切换，无 flash
- [ ] **Light Mode**：登录页、Dashboard、Posts 列表、Settings 与 Ghost Admin 风格一致
- [ ] **Dark Mode**：`.dark` 下 admin 色彩协调，sidebar 暗色、内容区暗色
- [ ] **Sidebar-only 布局**：桌面端无顶部 header，sidebar 固定左侧
- [ ] **Sidebar 浅色**：亮色模式下 sidebar 为浅色（Ghost 原始设计）
- [ ] **移动端**：sidebar 通过 Sheet drawer 正常访问
- [ ] **PostContent/CommentContent**：所有 7 个使用处已替换
- [ ] **Settings 全屏覆盖层**：点击 "系统设置" 打开全屏 overlay，搜索/导航/滚动联动正常
- [ ] **Settings 连续滚动**：14 个 section 纵向排列，左侧 nav 点击跳转，右侧滚动跟踪
- [ ] **Public 无回归**：`src/routes/public/` 页面视觉 100% 保持原样
- [ ] **测试**：`vp check` + `vp test` 全部通过
- [ ] **Token 契约**：`tests/contract.tailwind-tokens.test.ts` 通过
- [ ] **License**：`licenses/LICENSE.ghost-shade.txt` 存在

---

## 十一、License 与文档

### License

新建 `licenses/LICENSE.ghost-shade.txt`（Ghost MIT License）。

### README.md 追加

```markdown
## Design System

The admin dashboard UI uses components and design tokens derived from the
[Ghost Shade Design System](https://github.com/TryGhost/Ghost/tree/main/apps/shade),
used under the MIT License. See `licenses/LICENSE.ghost-shade.txt`.
```

### AGENTS.md 追加

```markdown
### Admin UI Components

Admin UI components under `src/ui/components/` are derived from Ghost Shade.
The admin theme is scoped to `html[data-admin-theme]` and is independent from
the public site's theme. The `data-admin-theme` attribute is set dynamically
by `root.tsx` based on the current route path.

Ghost Token names (e.g. `--focus-ring`, `--surface-elevated`) are mapped to
project tokens in `src/assets/styles/admin-theme.css`. When modifying admin
components, use the mapped token names, not Ghost's originals.
```
