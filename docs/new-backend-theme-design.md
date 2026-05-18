# Admin Dashboard 视觉重构计划

> 目标：以 Ghost Admin (Shade Design System) 为设计基准，对整个 `/admin` 后台进行系统性视觉升级。核心策略：**直接复用 Ghost Shade 的组件代码和设计令牌**，同时**彻底拆分 Admin 与 Public 的 CSS 主题层**，并**提取 `post-content` / `comment-content` 为跨层公共组件**。

---

## 一、Tailwind CSS 架构拆分：Admin / Public 主题隔离

### 1.1 当前问题

当前 `tailwind.css` 是一份 1000+ 行的单体文件，同时承载：
- Tailwind v4 语法层（`@import 'tailwindcss'`, `@theme inline`, `@layer base`）
- Public 页面的 `:root` / `.dark` 颜色值
- Admin 页面的颜色值（共享同一套 token）
- `prose-blog` @utility（含嵌套的 `&.post-content` / `&.comment-content`）
- 全局动画 keyframes

这导致 admin 和 public 的视觉系统完全耦合。要改变 admin 的按钮颜色，public 的按钮也会变。

### 1.2 目标架构：四文件拆分

```
src/assets/styles/
├── tailwind.css              ← 纯语法层（零颜色值）
│   ├── @import 'tailwindcss'
│   ├── @plugin '@tailwindcss/typography'
│   ├── @custom-variant dark
│   ├── @source '../..'
│   ├── @theme inline { ... }     ← 只注册变量映射，如 --color-background: var(--background)
│   ├── @layer base { ...reset... }
│   ├── html { font-family... }   ← 无 background-color / color
│   ├── @import './cursors.css'
│   ├── @utility prose-blog {     ← 只保留 &.prose 部分（Typography 插件覆盖）
│   │     &.prose { ... }
│   │   }
│   ├── @keyframes shake, comment-flash, comments-shimmer
│   └── @layer utilities { ...medium-zoom z-index... }
│
├── public-theme.css          ← Public 专属颜色值 + body 背景/文字色
│   ├── :root { --background: #fbfbfd; --foreground: #151b2b; ... }
│   ├── .dark { ... }
│   ├── @media (prefers-color-scheme: dark) { :root:not(.light,.dark) { ... } }
│   └── html, body { background-color: var(--surface-body); color: var(--ink-2); }
│
├── admin-theme.css           ← Admin 专属颜色值（Ghost Shade 风格）
│   ├── :root[data-admin-theme] { --background: #ffffff; --foreground: #15171a; ... }
│   ├── :root[data-admin-theme].dark { ... }
│   └── html[data-admin-theme] body { background-color: var(--background); color: var(--foreground); }
│
├── prose-content.css         ← post-content + comment-content（公共内容层）
│   ├── @utility post-content { ... }
│   └── @utility comment-content { ... }
│
├── aplayer.css               ← 现有，不动
├── cursors.css               ← 现有，不动
├── public.css                ← Public 入口
│   └── @import './tailwind.css'; @import './public-theme.css'; @import './prose-content.css';
└── admin.css                 ← Admin 入口
    └── @import './tailwind.css'; @import './admin-theme.css'; @import './prose-content.css';
```

### 1.3 运行时主题切换机制

**问题**：`useDetachPublicCss()` 只负责移除/恢复 `public.css`，但 `admin.css` 加载后不会自动卸载。当从 admin 导航回 public 时，DOM 中可能同时存在 admin.css 和 public.css，两者的 `:root` 定义会冲突。

**解决方案**：使用 `<html data-admin-theme>` 属性作为 Admin token 的 CSS 选择器。

**实施步骤**：

1. **CSS 层**：`admin-theme.css` 中所有 `:root` 选择器改为 `:root[data-admin-theme]`
2. **SSR + CSR 动态切换**：在 `root.tsx` 的 `Layout` 组件中读取当前 URL，动态设置/移除属性

```tsx
// src/root.tsx — Layout 组件改动
import { useLocation } from 'react-router'

function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData('root')
  const location = useLocation()
  const theme = rootData?.theme ?? null

  // 判断当前是否为 admin 路由（SSR + CSR 两用）
  const isAdminRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/signin')

  return (
    <html
      lang="zh-CN"
      className={theme ?? undefined}
      data-admin-theme={isAdminRoute ? '' : undefined}
    >
      {/* ... */}
    </html>
  )
}
```

3. **行为验证**：
   - SSR 访问 `/admin` → `<html data-admin-theme>` → admin token 生效 ✅
   - CSR 导航到 `/admin` → `useLocation()` 更新 → `<html data-admin-theme>` → admin token 生效 ✅
   - CSR 导航到 `/` → `useLocation()` 更新 → `<html>` 无属性 → public token 生效 ✅
   - `useDetachPublicCss()` 继续工作，admin.css 和 public.css 互不干扰

### 1.4 Tailwind `@theme inline` 合并策略

`tailwind.css` 的 `@theme inline` 需要同时兼容 Public 和 Admin 的变量映射。合并规则：

- **保留现有项目的全部映射**（`--color-background`, `--color-surface-body`, `--color-ink-1` 等）
- **追加 Ghost Shade 的映射**（`--color-sidebar-background`, `--color-text-primary`, `--shadow`, `--shadow-lg` 等）
- **冲突时以 Ghost Shade 的语义为准**（如 `--radius` 从 `0.3125rem` 改为 `0.5rem`）
- **新增映射需同步更新 `src/ui/lib/cn.ts`** 的 `tailwind-merge` 注册列表

---

## 二、`post-content` / `comment-content` 提取为公共组件

### 2.1 现状

当前 `post-content` 和 `comment-content` 的样式嵌套在 `tailwind.css` 的 `@utility prose-blog` 中：

```css
@utility prose-blog {
  &.prose { ... }
  &.post-content { ... }      ← 200+ 行
  &.comment-content { ... }   ← 70+ 行
}
```

使用方式是在组件中手写 className 组合：
```tsx
// public
<div className="post-content prose-blog prose prose-lg max-w-none">

// admin preview
<div className="post-content prose-blog prose prose-lg max-w-none">

// admin comment
<div className="comment-content prose-blog prose prose-sm max-w-none">
```

这导致：
- className 组合散落在 7+ 个文件中
- admin 和 public 的样式硬耦合在一份 CSS 中
- 无法独立演进 admin 和 public 的内容渲染风格

### 2.2 提取方案

**CSS 层**：将 `.post-content` 和 `.comment-content` 从 `prose-blog` utility 中提取为独立的 `@utility`：

```css
/* src/assets/styles/prose-content.css */
@import 'tailwindcss' source(none);

@utility post-content {
  /* 原 tailwind.css 中 &.post-content 的全部内容 */
  /* 需要把 prose-blog 中定义的内部变量（--prose-blog-table-border 等）在此重新定义 */
  --prose-blog-table-border: color-mix(in oklab, var(--line-muted) 78%, var(--ink-4) 22%);
  --prose-blog-table-header-bg: var(--surface);
  --prose-blog-table-stripe: color-mix(in oklab, var(--surface-soft) 55%, var(--canvas) 45%);

  &.prose-blog.prose { ... }   /* 保持与 prose-blog 的组合关系 */
}

@utility comment-content {
  /* 原 tailwind.css 中 &.comment-content 的全部内容 */
  &.prose-blog.prose { ... }
}
```

**组件层**：创建两个 React 公共组件，封装标准 className 组合：

```tsx
// src/ui/pt/PostContent.tsx
import { cn } from '@/ui/lib/cn'

interface PostContentProps {
  children: React.ReactNode
  className?: string
  ref?: React.Ref<HTMLDivElement>
}

export function PostContent({ children, className, ref }: PostContentProps) {
  return (
    <div
      ref={ref}
      className={cn('post-content prose-blog prose prose-lg max-w-none', className)}
    >
      {children}
    </div>
  )
}

// src/ui/pt/CommentContent.tsx
interface CommentContentProps {
  children: React.ReactNode
  className?: string
}

export function CommentContent({ children, className }: CommentContentProps) {
  return (
    <div className={cn('comment-content prose-blog prose prose-sm max-w-none', className)}>
      {children}
    </div>
  )
}
```

### 2.3 替换范围

| 原文件 | 原代码 | 替换为 |
|--------|--------|--------|
| `ui/public/post/DetailBodyChrome.tsx:135` | `<div className="post-content prose-blog prose prose-lg max-w-none">` | `<PostContent ref={postContentRef}>` |
| `ui/admin/editor-shell/PreviewPanel.tsx:109` | `<div ref={previewPostContentRef} className="post-content prose-blog prose prose-lg max-w-none">` | `<PostContent ref={previewPostContentRef}>` |
| `ui/admin/editor/PageBodyEditor.tsx:430` | `'post-content pt-body-editor prose-blog prose prose-lg max-w-none'` | `<PostContent className="pt-body-editor focus:outline-none">`（Editor 特殊处理）|
| `ui/public/comments/comment-item/helpers.ts:146` | `cn('comment-content', 'prose-blog prose prose-sm max-w-none', ...)` | `commentContentClasses()` 辅助函数 或直接使用 `<CommentContent>` |
| `ui/admin/users/UserDetailView.tsx:602` | `<div className="comment-content prose-blog prose ...">` | `<CommentContent className="mt-1 line-clamp-3 text-sm leading-snug [&>*]:!my-0">` |
| `ui/admin/my/MyCommentsView.tsx:438` | `<div className="comment-content prose-blog my-2 prose ...">` | `<CommentContent className="my-2 mt-3 leading-[1.85]">` |
| `ui/admin/comments/AdminCommentRow.tsx:251` | `<div className="comment-content prose-blog my-2 prose ...">` | `<CommentContent className="my-2 mt-3 leading-[1.85]">` |

> **注意**：Editor 中的 `PageBodyEditor` 使用 Tiptap 的 `EditorContent` 组件，它直接接收 `className` prop，不便于包裹为 `<PostContent>`。此处可以保留 `className` 字符串，但改用从 `PostContent` 导出的常量：`const POST_CONTENT_CLASSES = 'post-content prose-blog prose prose-lg max-w-none'`。

---

## 三、设计令牌迁移（Ghost Shade → 项目 Admin 主题）

### 3.1 Admin 主题 Token（`admin-theme.css`）

直接从 Ghost Shade 的 `theme-variables.css` 复制并精简：

```css
/* src/assets/styles/admin-theme.css */

:root[data-admin-theme] {
  /* Primitive colours (Ghost) */
  --black: #15171a;
  --white: #fff;
  --green: #30cf43;
  --red: #f50b23;

  /* Greys */
  --grey-100: #f4f5f6;
  --grey-150: #f1f3f4;
  --grey-200: #ebeef0;
  --grey-250: #e5e9ed;
  --grey-300: #dde1e5;
  --grey-400: #ced4d9;
  --grey-500: #aeb7c1;
  --grey-600: #95a1ad;
  --grey-700: #7c8b9a;
  --grey-800: #626d79;
  --grey-900: #394047;
  --grey-950: #222427;
  --grey-975: #191b1e;

  /* Semantic shadcn aliases */
  --background: #ffffff;
  --foreground: #15171a;
  --card: #ffffff;
  --card-foreground: #15171a;
  --popover: #ffffff;
  --popover-foreground: #15171a;
  --primary: #15171a;
  --primary-foreground: #ffffff;
  --secondary: #f4f5f6;
  --secondary-foreground: #15171a;
  --muted: #f4f5f6;
  --muted-foreground: #7c8b9a;
  --accent: #f4f5f6;
  --accent-foreground: #15171a;
  --destructive: #f50b23;
  --destructive-foreground: #ffffff;
  --border: #ebeef0;
  --input: #e5e9ed;
  --ring: #30cf43;
  --radius: 0.5rem;

  /* Sidebar (dark chrome) */
  --sidebar-background: #191b1e;
  --sidebar-foreground: #a9b0b7;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #191b1e;
  --sidebar-accent: #222427;
  --sidebar-accent-foreground: #e3e6e8;
  --sidebar-border: #22252a;
  --sidebar-ring: #30cf43;

  /* Ghost Shade shadows */
  --shadow: 0 0 1px rgba(0,0,0,.05), 0 5px 18px rgba(0,0,0,.08);
  --shadow-sm: 0 0 1px rgba(0,0,0,.12), 0 1px 6px rgba(0,0,0,.03), 0 8px 10px -8px rgba(0,0,0,.1);
  --shadow-md: 0 0 1px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,.03), 0 8px 10px -8px rgba(0,0,0,0.05), 0px 24px 37px -21px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 0 7px rgba(0, 0, 0, 0.08), 0 2.1px 2.2px -5px rgba(0, 0, 0, 0.011), 0 5.1px 5.3px -5px rgba(0, 0, 0, 0.016), 0 9.5px 10px -5px rgba(0, 0, 0, 0.02), 0 17px 17.9px -5px rgba(0, 0, 0, 0.024), 0 31.8px 33.4px -5px rgba(0, 0, 0, 0.029), 0 76px 80px -5px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 2.8px 2.2px rgba(0, 0, 0, 0.02), 0 6.7px 5.3px rgba(0, 0, 0, 0.028), 0 12.5px 10px rgba(0, 0, 0, 0.035), 0 22.3px 17.9px rgba(0, 0, 0, 0.042), 0 41.8px 33.4px rgba(0, 0, 0, 0.05), 0 100px 80px rgba(0, 0, 0, 0.07);
}

:root[data-admin-theme].dark {
  --background: #15171a;
  --foreground: #e3e6e8;
  --card: #15171a;
  --card-foreground: #e3e6e8;
  --popover: #15171a;
  --popover-foreground: #e3e6e8;
  --primary: #ffffff;
  --primary-foreground: #15171a;
  --secondary: #222427;
  --secondary-foreground: #e3e6e8;
  --muted: #222427;
  --muted-foreground: #7b8189;
  --accent: #222427;
  --accent-foreground: #e3e6e8;
  --destructive: #f50b23;
  --destructive-foreground: #ffffff;
  --border: #22252a;
  --input: #2e3338;
  --ring: #30cf43;

  --sidebar-background: #0c0e10;
  --sidebar-foreground: #e3e6e8;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #0c0e10;
  --sidebar-accent: #222427;
  --sidebar-accent-foreground: #e3e6e8;
  --sidebar-border: #22252a;
  --sidebar-ring: #30cf43;
}

html[data-admin-theme] body {
  background-color: var(--background);
  color: var(--foreground);
}
```

### 3.2 Public 主题 Token（`public-theme.css`）

将现有 `tailwind.css` 中的 `:root` / `.dark` / `@media prefers-color-scheme` 块完整迁移到 `public-theme.css`，**不做任何颜色值改动**，确保 public 页面 100% 视觉回归安全。

---

## 四、Ghost Shade 组件复用清单

### 4.1 ★★★★★ 直接复制（零改动或极少改动）

| Ghost Shade 源文件 | 项目目标位置 | 迁移说明 |
|-------------------|-------------|---------|
| `apps/shade/src/components/ui/button.tsx` | `src/ui/components/button.tsx` | 替换现有。保留项目额外 variant（destructive-soft, fab, light, dark, shape） |
| `apps/shade/src/components/ui/badge.tsx` | `src/ui/components/badge.tsx` | 直接替换 |
| `apps/shade/src/components/ui/card.tsx` | `src/ui/components/card.tsx` | 直接替换。新增 `variant="outline"` |
| `apps/shade/src/components/ui/avatar.tsx` | `src/ui/components/avatar.tsx` | 直接替换 |
| `apps/shade/src/components/ui/separator.tsx` | `src/ui/components/separator.tsx` | 直接替换 |
| `apps/shade/src/components/ui/skeleton.tsx` | `src/ui/components/skeleton.tsx` | 直接替换 |
| `apps/shade/src/components/ui/label.tsx` | `src/ui/components/label.tsx` | 新增/替换 |
| `apps/shade/src/components/ui/sonner.tsx` | `src/ui/components/sonner.tsx` | Toast 样式对齐 |
| `apps/shade/src/components/primitives/*.tsx` | `src/ui/primitives/*.tsx` | 新增 6 个 layout primitives（Box, Stack, Inline, Grid, Text, Container） |

### 4.2 ★★★★☆ 适配复制（需调整）

| Ghost Shade 源文件 | 项目目标位置 | 需调整内容 |
|-------------------|-------------|-----------|
| `apps/shade/src/components/ui/dialog.tsx` | `src/ui/components/dialog.tsx` | 移除 `SHADE_APP_NAMESPACES` wrapper |
| `apps/shade/src/components/ui/sheet.tsx` | `src/ui/components/sheet.tsx` | 移除 `SHADE_APP_NAMESPACES` wrapper |
| `apps/shade/src/components/ui/dropdown-menu.tsx` | `src/ui/components/dropdown-menu.tsx` | 移除 `SHADE_APP_NAMESPACES` wrapper |
| `apps/shade/src/components/ui/select.tsx` | `src/ui/components/select.tsx` | 移除 `SHADE_APP_NAMESPACES`，内联 `inputSurface` 逻辑 |
| `apps/shade/src/components/ui/popover.tsx` | `src/ui/components/popover.tsx` | 移除 `SHADE_APP_NAMESPACES` wrapper |
| `apps/shade/src/components/ui/tooltip.tsx` | `src/ui/components/tooltip.tsx` | 直接替换 |
| `apps/shade/src/components/ui/alert-dialog.tsx` | `src/ui/components/alert-dialog.tsx` | 新增 |
| `apps/shade/src/components/ui/accordion.tsx` | `src/ui/components/accordion.tsx` | 新增 |
| `apps/shade/src/components/ui/tabs.tsx` | `src/ui/components/tabs.tsx` | 直接替换 |
| `apps/shade/src/components/ui/checkbox.tsx` | `src/ui/components/checkbox.tsx` | 直接替换 |
| `apps/shade/src/components/ui/switch.tsx` | `src/ui/components/switch.tsx` | 直接替换 |
| `apps/shade/src/components/ui/radio-group.tsx` | `src/ui/components/radio-group.tsx` | 直接替换 |
| `apps/shade/src/components/ui/calendar.tsx` | `src/ui/components/calendar.tsx` | 若不同则替换 |

### 4.3 ★★★☆☆ 参考实现（结构借鉴，代码重写）

| Ghost Shade 源文件 | 借鉴内容 | 重写原因 |
|-------------------|---------|---------|
| `apps/shade/src/components/ui/sidebar.tsx` | 773 LOC，cookie 状态、快捷键、tooltip、rail | 太重。精简为项目专用版本（200-300 LOC） |
| `apps/shade/src/components/ui/field.tsx` | 241 LOC，horizontal/vertical/responsive 表单布局 | 太 opinionated。适配项目现有表单模式 |
| `apps/shade/src/components/ui/table.tsx` | 153 LOC，compound + head variant | 可直接复制，检查 API 兼容性 |
| `apps/shade/src/components/ui/input.tsx` | 依赖 `inputSurface()` recipe | 内联 inputSurface 或单独提取 |

### 4.4 不复用（项目专用，保持不动）

- `empty.tsx` — 项目自定义空状态
- `combobox.tsx` — 项目自定义 searchable dropdown
- `field.tsx`（现有的）— 基于 Base UI
- `editor/` 下所有 Tiptap 组件
- `ui/pt/` 下 PortableText 渲染器
- `ui/public/` 下所有 public 组件

### 4.5 forwardRef → Prop Ref 批量迁移

Ghost Shade 使用 React 18 的 `forwardRef`。项目使用 React 19 的 prop ref。**每个复制过来的组件都需要此改动**：

```tsx
// Ghost Shade (React 18)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)

// 项目 (React 19)
function Button({ className, variant, size, asChild = false, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
}
```

---

## 五、可并行执行的 Agent 模块

整个重构拆分为 **11 个独立 Agent 模块**，按 **Phase 1（并行）→ Phase 2（并行）→ Phase 3（串行）** 执行。

### Phase 1：基础设施（5 个模块并行）

> 模块 A/B/C/D/E 之间无依赖，可完全并行。

---

#### Module A: CSS 架构拆分（Token + Theme + Prose Content）

**负责人 Agent**: 1 个
**输入**: 现有 `tailwind.css`, Ghost Shade `theme-variables.css` / `tailwind.theme.css`
**输出**: 拆分后的 5 个 CSS 文件 + 更新的 `root.tsx`

**任务清单**:
1. 创建 `src/assets/styles/public-theme.css`：从现有 `tailwind.css` 提取 `:root` / `.dark` / `@media prefers-color-scheme` 全部 public 颜色值
2. 创建 `src/assets/styles/admin-theme.css`：从 Ghost Shade 复制并精简 admin 颜色值，选择器使用 `:root[data-admin-theme]`
3. 创建 `src/assets/styles/prose-content.css`：提取 `.post-content` 和 `.comment-content` 为独立 `@utility`
4. 重写 `src/assets/styles/tailwind.css`：移除颜色值、移除 post-content/comment-content、保留语法层
5. 更新 `src/assets/styles/public.css`：`@import './tailwind.css'; @import './public-theme.css'; @import './prose-content.css';`
6. 更新 `src/assets/styles/admin.css`：`@import './tailwind.css'; @import './admin-theme.css'; @import './prose-content.css';`
7. 更新 `src/ui/lib/cn.ts`：追加 Shade token 到 `tailwind-merge` 注册列表
8. 更新 `src/root.tsx` 的 `Layout`：添加 `useLocation()`，动态设置 `data-admin-theme`
9. **验证**: `vp check` 通过；访问 public 首页确认视觉无回归；访问 admin 确认新主题生效

**关键文件**:
- `src/assets/styles/tailwind.css`（重写）
- `src/assets/styles/public-theme.css`（新建）
- `src/assets/styles/admin-theme.css`（新建）
- `src/assets/styles/prose-content.css`（新建）
- `src/assets/styles/public.css`（更新）
- `src/assets/styles/admin.css`（更新）
- `src/ui/lib/cn.ts`（更新）
- `src/root.tsx`（更新 Layout）

---

#### Module B: 基础组件库 — 核心 UI（Core UI Components）

**负责人 Agent**: 1 个
**输入**: Ghost Shade `src/components/ui/` 源码
**输出**: 更新后的 `src/ui/components/` + 新增 `src/ui/primitives/`
**依赖**: Module A（token 已就位）

**任务清单**:
1. 从 Ghost Shade 复制并替换：
   - `button.tsx`（保留项目额外 variants）
   - `badge.tsx`
   - `card.tsx`
   - `avatar.tsx`
   - `separator.tsx`
   - `skeleton.tsx`
   - `label.tsx`
   - `sonner.tsx`
2. 新增 primitives 目录：`box.tsx`, `stack.tsx`, `inline.tsx`, `grid.tsx`, `text.tsx`, `container.tsx`
3. 所有组件：`forwardRef` → prop ref，`@/lib/utils` → `@/ui/lib/cn`

**关键文件**:
- `src/ui/components/button.tsx`
- `src/ui/components/badge.tsx`
- `src/ui/components/card.tsx`
- `src/ui/components/avatar.tsx`
- `src/ui/components/separator.tsx`
- `src/ui/components/skeleton.tsx`
- `src/ui/components/label.tsx`
- `src/ui/components/sonner.tsx`
- `src/ui/primitives/*`（6 个新增）

---

#### Module C: 基础组件库 — 覆盖层与表单（Overlays & Forms）

**负责人 Agent**: 1 个
**输入**: Ghost Shade overlay/form 组件
**输出**: 更新后的 overlay/form 组件
**依赖**: Module A

**任务清单**:
1. 复制并适配（移除 `SHADE_APP_NAMESPACES`）：
   `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `select.tsx`, `popover.tsx`, `tooltip.tsx`, `alert-dialog.tsx`
2. 直接复制：`accordion.tsx`, `tabs.tsx`, `checkbox.tsx`, `switch.tsx`, `radio-group.tsx`, `calendar.tsx`
3. 新增 `command.tsx`（可选）
4. 同样进行 forwardRef → prop ref 迁移

**关键文件**:
- `src/ui/components/dialog.tsx`
- `src/ui/components/sheet.tsx`
- `src/ui/components/dropdown-menu.tsx`
- `src/ui/components/select.tsx`
- `src/ui/components/popover.tsx`
- `src/ui/components/tooltip.tsx`
- `src/ui/components/alert-dialog.tsx`
- `src/ui/components/accordion.tsx`
- `src/ui/components/tabs.tsx`
- `src/ui/components/checkbox.tsx`
- `src/ui/components/switch.tsx`
- `src/ui/components/radio-group.tsx`
- `src/ui/components/calendar.tsx`

---

#### Module D: 布局层重构 — Sidebar-only Admin Shell

**负责人 Agent**: 1 个
**输入**: Ghost Shade `sidebar.tsx` + 现有 `AdminShell.tsx`
**输出**: 重写后的 `AdminShell.tsx`
**依赖**: Module A, Module C

**任务清单**:
1. 参考 Ghost Shade `sidebar.tsx` 精简重写项目专用 Sidebar（200-300 LOC）
2. 重写 `src/ui/admin/shell/AdminShell.tsx`：
   - 移除顶部 header
   - Sidebar 深色背景（`bg-sidebar` = `#191b1e`）
   - 包含：Logo、主导航、底部用户区
   - 内容区：`flex-1`, `overflow-y-auto`, `bg-background`
   - 移动端：Sheet drawer（使用 Module C 的 Sheet）
3. 更新 `AdminScrollTopButton.tsx` 适配新布局
4. 保留 `AdminChromeContext`（focus mode, scrollTopLifted）

**关键文件**:
- `src/ui/admin/shell/AdminShell.tsx`（重写）
- `src/ui/admin/shell/AdminScrollTopButton.tsx`（调整）

---

#### Module E: PostContent / CommentContent 公共组件提取

**负责人 Agent**: 1 个
**输入**: 现有 `tailwind.css` 中的 post-content / comment-content 样式 + 7 个使用处
**输出**: 新组件 + 所有使用处替换
**依赖**: Module A（prose-content.css 已就位）

**任务清单**:
1. 创建 `src/ui/pt/PostContent.tsx`：封装 `post-content prose-blog prose prose-lg max-w-none`
2. 创建 `src/ui/pt/CommentContent.tsx`：封装 `comment-content prose-blog prose prose-sm max-w-none`
3. 导出常量 `POST_CONTENT_BASE_CLASSES` 和 `COMMENT_CONTENT_BASE_CLASSES` 供 Editor 等无法直接包裹的场景使用
4. 替换所有使用处（见 2.3 替换范围表）
5. 检查 `CodeBlock.tsx` 中的 `in-[.comment-content]` 选择器是否仍然生效

**关键文件**:
- `src/ui/pt/PostContent.tsx`（新增）
- `src/ui/pt/CommentContent.tsx`（新增）
- `src/ui/public/post/DetailBodyChrome.tsx`
- `src/ui/admin/editor-shell/PreviewPanel.tsx`
- `src/ui/admin/editor/PageBodyEditor.tsx`
- `src/ui/public/comments/comment-item/helpers.ts`
- `src/ui/admin/users/UserDetailView.tsx`
- `src/ui/admin/my/MyCommentsView.tsx`
- `src/ui/admin/comments/AdminCommentRow.tsx`

---

### Phase 2：页面层重构（5 个模块并行）

> 模块 F/G/H/I/J 依赖 Phase 1 完成，但彼此之间无依赖，可并行。

---

#### Module F: 登录页与认证页面（Login & Auth）

**负责人 Agent**: 1 个
**依赖**: Module A, Module B, Module E

**任务清单**:
1. 重写 `src/routes/auth/signin.tsx`：移除 Card，改为居中 flow（max-w-[500px]）
2. 重写 `src/ui/admin/auth/AdminCredentialsForm.tsx`：
   - 大输入框（`h-12` / `h-13`, `rounded-lg`, `bg-muted`）
   - Focus：白底 + 绿色 border + `ring-2 ring-[#30cf43]/25`
   - 密码框内嵌 "忘记密码"（Ghost 风格）
   - 全宽黑色 primary 按钮（`h-12`, `rounded-lg`）
3. 同步更新 `install/index.tsx` 和 `install/settings.tsx`

**关键文件**:
- `src/routes/auth/signin.tsx`
- `src/ui/admin/auth/AdminCredentialsForm.tsx`
- `src/routes/auth/install/index.tsx`
- `src/routes/auth/install/settings.tsx`

---

#### Module G: 列表页（List Views）

**负责人 Agent**: 1 个
**依赖**: Module A, Module B, Module D, Module E

**任务清单**:
1. 更新 `src/ui/admin/shared/AdminListPage.tsx`：
   - Header 标题：`text-3xl font-bold tracking-tight`
   - Toolbar Card：`variant="outline"`，增大 padding
2. 更新所有 List View 适配新 Table、Button、Badge、Input 样式：
   - `PostsView.tsx`, `PagesView.tsx`, `CommentsView.tsx`
   - `UsersView.tsx`, `SessionsView.tsx`
   - `ImagesView.tsx`, `MusicsView.tsx`
   - `CategoriesView.tsx`, `TagsView.tsx`, `FriendsView.tsx`

**关键文件**:
- `src/ui/admin/shared/AdminListPage.tsx`
- `src/ui/admin/posts/PostsView.tsx`
- `src/ui/admin/pages/PagesView.tsx`
- `src/ui/admin/comments/CommentsView.tsx`
- `src/ui/admin/users/UsersView.tsx`
- `src/ui/admin/sessions/SessionsView.tsx`
- `src/ui/admin/images/ImagesView.tsx`
- `src/ui/admin/musics/MusicsView.tsx`
- `src/ui/admin/categories/CategoriesView.tsx`
- `src/ui/admin/tags/TagsView.tsx`
- `src/ui/admin/friends/FriendsView.tsx`

---

#### Module H: 设置页（Settings Pages）

**负责人 Agent**: 1 个
**依赖**: Module A, Module B, Module C

**任务清单**:
1. 更新 `SettingsShell.tsx`：settings sidebar 配色适配新 token
2. 更新 `SettingsSection.tsx`：改用 `Card variant="outline"`，`rounded-xl`，`p-6`
3. 更新 `SettingsRow.tsx`：调整 label/control 间距
4. 遍历所有 `*Form.tsx`：统一更新输入框、按钮、间距

**关键文件**:
- `src/ui/admin/settings/SettingsShell.tsx`
- `src/ui/admin/settings/SettingsSection.tsx`
- `src/ui/admin/settings/SettingsRow.tsx`
- `src/ui/admin/settings/*Form.tsx`（13 个文件）

---

#### Module I: Dashboard、个人中心与杂项视图（Dashboard, My, Analytics, User Detail）

**负责人 Agent**: 1 个
**依赖**: Module A, Module B, Module E

**任务清单**:
1. 更新 `src/routes/admin/welcome.tsx`：
   - 页面标题 `text-3xl font-bold tracking-tight`
   - StatsGrid 卡片改用 bordered style，增大间距
2. 更新 `src/ui/admin/welcome/*` widget 组件
3. 更新 `src/ui/admin/my/*.tsx`
4. 更新 `src/ui/admin/analytics/*.tsx`
5. 更新 `src/ui/admin/users/UserDetailView.tsx`

**关键文件**:
- `src/routes/admin/welcome.tsx`
- `src/ui/admin/welcome/*`
- `src/ui/admin/my/MyProfileView.tsx`
- `src/ui/admin/my/MyCommentsView.tsx`
- `src/ui/admin/my/MySessionsView.tsx`
- `src/ui/admin/analytics/*.tsx`
- `src/ui/admin/users/UserDetailView.tsx`

---

#### Module J: 编辑器适配（Editor Shell & Editor）

**负责人 Agent**: 1 个
**依赖**: Module A, Module B, Module E

**任务清单**:
1. 更新 `editor-shell/*.tsx`：按钮样式、面板边框阴影
2. 更新 `editor/*.tsx`：BubbleMenu、SlashMenu、ImageNodeView 等
3. 确保 focus mode 在 Sidebar-only 布局下正常工作
4. 确保 `PostContent` 常量在 Editor 中正确使用

**关键文件**:
- `src/ui/admin/editor-shell/PostEditorShell.tsx`
- `src/ui/admin/editor-shell/PageEditorShell.tsx`
- `src/ui/admin/editor-shell/FloatingPublishButton.tsx`
- `src/ui/admin/editor-shell/PreviewPanel.tsx`
- `src/ui/admin/editor/*.tsx`

---

### Phase 3：收尾与一致性（1 个模块，串行）

#### Module K: 全局检查、License 与文档

**负责人 Agent**: 1 个
**依赖**: Phase 1 和 Phase 2 全部完成

**任务清单**:
1. **全局搜索替换**:
   - `max-w-7xl` → `max-w-[1480px]` 或移除
   - 旧 shadow class → 新 shadow token
   - 旧 card pattern → `Card variant="outline"`
2. **Public 回归检查**: 确认 `src/routes/public/` 页面无视觉回归
3. **测试**: `vp check` + `vp test`
4. **License**:
   - 新建 `licenses/LICENSE.ghost-shade.txt`（Ghost MIT License）
   - `README.md` 追加 Design System 章节
   - `AGENTS.md` 追加 Admin UI 组件说明
5. **清理**: 删除不再使用的旧组件文件

**关键文件**:
- `licenses/LICENSE.ghost-shade.txt`（新增）
- `README.md`（追加）
- `AGENTS.md`（追加）

---

## 六、Agent 并行执行依赖图

```
Phase 1（5 个模块完全并行）
├── Module A: CSS 架构拆分 ────────┐
├── Module B: Core UI 组件 ────────┤
├── Module C: Overlays & Forms ────┤──→ Phase 2（5 个模块完全并行）
├── Module D: Sidebar-only Shell ──┤      ├── Module F: Login & Auth
└── Module E: Post/Comment 组件 ───┘      ├── Module G: List Views
                                          ├── Module H: Settings
                                          ├── Module I: Dashboard & My
                                          └── Module J: Editor
                                                         │
                                              Phase 3（串行）
                                              └── Module K: Polish & Docs
```

---

## 七、License 与文档

### 7.1 Ghost Shade MIT License 声明

新建 `licenses/LICENSE.ghost-shade.txt`：

```
Ghost Shade Design System
Copyright (c) 2013-2025 Ghost Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 7.2 README.md 追加

```markdown
## Design System

The admin dashboard UI is styled using components and design tokens derived from the
[Ghost Shade Design System](https://github.com/TryGhost/Ghost/tree/main/apps/shade),
used under the MIT License. See `licenses/LICENSE.ghost-shade.txt`.
```

### 7.3 AGENTS.md 追加

```markdown
### Admin UI Components

Most admin UI components under `src/ui/components/` are derived from Ghost Shade.
When modifying these components, refer to the original source in
`/Users/YufanSheng/Downloads/Ghost/apps/shade/src/components/ui/` for the
intended design behavior. Do not reintroduce old component APIs without
updating all call sites.

The admin theme is scoped to `html[data-admin-theme]` and is independent from
the public site's theme. The `data-admin-theme` attribute is set dynamically
by `root.tsx` based on the current route path.
```

---

## 八、验收标准

- [ ] **CSS 拆分验证**: `tailwind.css` 中无 `:root` 颜色值、`public-theme.css` 和 `admin-theme.css` 独立存在
- [ ] **主题切换验证**: 访问 public 首页 → 导航到 admin → 导航回 public，颜色和背景正确切换，无 flash
- [ ] **Light Mode 视觉**: 登录页、Dashboard、Posts 列表、Settings 与 Ghost Admin 风格一致
- [ ] **Dark Mode 视觉**: `.dark` 下 admin 页面色彩协调，sidebar 深色、内容区暗色
- [ ] **Sidebar-only 布局**: 桌面端无顶部 header，sidebar 固定左侧，内容区可滚动
- [ ] **移动端**: sidebar 通过 Sheet drawer 正常访问
- [ ] **PostContent/CommentContent**: 所有 7 个使用处已替换为新组件，内容渲染正常
- [ ] **Public 无回归**: `src/routes/public/` 页面视觉 100% 保持原样
- [ ] **测试通过**: `vp check` + `vp test` 全部通过
- [ ] **License 合规**: `licenses/LICENSE.ghost-shade.txt` 存在，README 和 AGENTS.md 已更新
