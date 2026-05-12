# 项目重构路线图 — 全量审计报告

> 生成日期：2026-05-12
> 审计范围：工程规范、路由数据层、编辑器/PortableText 层、UI 组件与样式层、长期架构演进

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [工程规范与构建层](#2-工程规范与构建层)
3. [路由与数据层](#3-路由与数据层)
4. [编辑器与 PortableText 层](#4-编辑器与-portabletext-层)
5. [UI 组件与样式层](#5-ui-组件与样式层)
6. [长期架构演进方向](#6-长期架构演进方向)
7. [执行时间线建议](#7-执行时间线建议)
8. [验证清单](#8-验证清单)

---

## 1. 执行摘要

### 1.1 统计概览

| 优先级 | 数量 | 风险域 |
|--------|------|--------|
| **P0 — 必须立即修复** | 13 | 生产可用性、架构边界违规、数据丢失、性能浪费 |
| **P1 — 建议下一轮处理** | 24 | 工程债务、可访问性、代码组织、Bundle 优化 |
| **P2 — 可选优化** | 18 | 缓存策略、类型安全、CI/CD、脚本效率 |
| **长期架构** | 6 | 状态源统一、类型安全、目录重组、异步化演进 |

### 1.2 P0 速览

1. `aplayer-ts`/`medium-zoom`/`qrcode.react` 在 `devDependencies` 中，Docker `npm ci --omit=dev` 导致生产 404
2. `src/server/logger.ts` 绕过 t3-env 直接读 `process.env.LOG_LEVEL`
3. React Router 未启用 `v8_splitRouteModules`
4. `@/server/seo/meta` 被 `meta()` 导入，存在 client bundle 污染风险
5. `post.detail.tsx` / `page.detail.tsx` 的 `defer()` 缺失，评论流式渲染完全失效
6. Shiki Highlighter 每次保存重复创建（80ms+）
7. 表格内 `$...$` 输入规则导致 mathInline 内容静默丢失
8. ImageNodeView 的 React state 与 node attrs 不同步
9. PM->PT 桥接 flatten blockquote 导致嵌套内容丢失
10. PageBodyEditor.tsx 过于庞大（1172 行）
11. Popup 组件缺失 ARIA dialog 属性
12. MusicPlayer 使用未定义的 spacing token
13. Image 组件逻辑在 Image.tsx 和 BlockImage.tsx 中重复

---

## 2. 工程规范与构建层

### 2.1 P0 — 必须立即修复

#### P0-E1. 客户端动态导入依赖被错误归类为 devDependencies

- **文件**：`package.json` 第 111–114 行
- **问题**：`aplayer-ts`、`medium-zoom`、`qrcode.react` 在 `devDependencies` 中，但客户端通过 `import()` 动态加载。`Dockerfile` 第三阶段执行 `npm ci --omit=dev`，会导致生产运行时这些 chunk 404。
- **修复**：移动到 `dependencies`：

```json
"dependencies": {
  "aplayer-ts": "^2.6.0",
  "medium-zoom": "^1.1.0",
  "qrcode.react": "^4.2.0"
}
```

#### P0-E2. `src/server/logger.ts` 绕过 t3-env 直接读取 `process.env`

- **文件**：`src/server/logger.ts` 第 29 行
- **问题**：直接读取 `process.env.LOG_LEVEL`，而 `@/server/env.ts` 已导出 validated 的 `LOG_LEVEL`。违反"所有环境变量必须通过 t3-env facade 读取"的架构约定。
- **修复**：

```typescript
import { LOG_LEVEL } from '@/server/env'

function readMinLevel(): Level {
  const meta = (import.meta as { env?: { PROD?: boolean } }).env
  const fallback = meta?.PROD === true ? 'info' : 'debug'
  if (typeof process === 'undefined') {
    return fallback
  }
  return isLevel(LOG_LEVEL) ? LOG_LEVEL : fallback
}
```

#### P0-E3. React Router 缺少 `v8_splitRouteModules` 优化 flag

- **文件**：`react-router.config.ts`
- **问题**：已启用 `v8_middleware` 和 `v8_viteEnvironmentApi`，但缺少 `v8_splitRouteModules`。该 flag 在 React Router 7.15+ 中可自动将路由模块拆分为多个 chunk，减少首屏加载。
- **修复**：

```typescript
export default {
  appDirectory: 'src',
  ssr: true,
  routeDiscovery: { mode: 'initial' },
  future: {
    v8_middleware: true,
    v8_viteEnvironmentApi: true,
    v8_splitRouteModules: true,
  },
} satisfies Config
```

### 2.2 P1 — 建议下一轮处理

#### P1-E4. `src/server/catalog/index.ts` 是巨型跨域 barrel 文件

- **文件**：`src/server/catalog/index.ts`
- **问题**：re-export 了来自 4 个不同子目录的函数（`@/server/pages/query`、`@/server/posts/query`、`@/server/catalog/queries`、`@/shared/catalog`），15 个外部导入点全部通过该 barrel，bundler 无法做死代码消除。
- **修复**：逐步迁移为直接导入源模块：

```typescript
// Before
import { findPostBySlug } from '@/server/catalog'
// After
import { findPostBySlug } from '@/server/posts/query'
```

#### P1-E5. `src/server/db/types/index.ts` 是已标记 deprecated 的 barrel 文件

- **文件**：`src/server/db/types/index.ts`
- **问题**：文件头部明确标注 `@deprecated Import from @/server/db/types/inferred directly.`，但仍有 27 个外部导入点使用它。
- **修复**：批量替换 `from '@/server/db/types'` 为 `from '@/server/db/types/inferred'`，然后删除该 barrel 文件。

#### P1-E6. `src/shared/pt/bridge/index.ts` 是 barrel 文件

- **文件**：`src/shared/pt/bridge/index.ts`
- **问题**：re-export 了 `./types`、`./pt-to-pm`、`./pm-to-pt`、`./canonicalize`、`./nodes/footnote`，7 个外部导入点。由于该模块在 `shared/`（isomorphic），barrel 的影响同时波及 server bundle 和 client bundle。
- **修复**：将导入点改为直接引用子模块。

#### P1-E7. Dockerfile 使用非 LTS Node 版本

- **文件**：`Dockerfile` 第 1 行和第 11 行
- **问题**：`node:25-alpine` 是奇数版本，非 LTS，生命周期短。当前 LTS 是 Node 22。
- **修复**：改为 `node:22-alpine`。

#### P1-E8. oxlint 中 `typescript/no-unsafe-*` 系列规则被整体关闭

- **文件**：`oxlint.config.ts` 第 87–92 行
- **问题**：以下 6 条规则被设为 `'off'`：
  - `typescript/no-unsafe-argument`
  - `typescript/no-unsafe-assignment`
  - `typescript/no-unsafe-call`
  - `typescript/no-unsafe-member-access`
  - `typescript/no-unsafe-return`
  - `typescript/no-unsafe-type-assertion`
- **修复**：至少将 `typescript/no-unsafe-type-assertion` 设为 `'error'`，其余逐步开启为 `'warn'`。

#### P1-E9. Vite build 配置缺少代码分割优化

- **文件**：`vite.config.ts` 第 64–66 行
- **问题**：`build` 块仅配置了 `emptyOutDir: true`，缺少 `rollupOptions.output.manualChunks`、`chunkSizeWarningLimit`、`target`。
- **修复**：

```typescript
build: {
  emptyOutDir: true,
  chunkSizeWarningLimit: 600,
  rollupOptions: {
    output: {
      manualChunks: {
        tiptap: ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
        'shadcn-vendor': ['@base-ui/react'],
      },
    },
  },
},
```

#### P1-E10. Coverage 排除 `src/routes/**/*.tsx` 过于宽泛

- **文件**：`vite.config.ts` 第 39 行
- **问题**：全量排除所有路由模块，但部分路由（如 `routes/api/actions/admin.reindexSearch.ts`）包含复杂逻辑。
- **修复**：精确排除纯布局路由，保留 API action 路由的覆盖追踪。

### 2.3 P2 — 可选优化

#### P2-E11. `src/server/db/schema.ts` 被完全排除在 coverage 外

- **文件**：`vite.config.ts` 第 29 行
- **问题**：coverage 中排除了 `schema.ts`。虽然主要是 Drizzle ORM 表定义，但可能包含自定义 helper（如枚举、表达式）值得测试。

#### P2-E12. `routeDiscovery.mode: 'initial'` 可能不是最优

- **文件**：`react-router.config.ts`
- **问题**：显式设置为 `initial`（禁用懒路由发现）。对于大型 admin SPA（20+ 路由），`lazy` 模式可减少首屏 manifest 大小。
- **评估**：如果首屏性能已满足可保留；否则建议测试 `lazy` 模式。

#### P2-E13. `check` 脚本串行执行 lint 和 typecheck

- **文件**：`package.json`
- **问题**：`"check": "vp lint && vp run typecheck && vp test run"` 三步串行，但 lint 和 typecheck 无依赖关系。
- **修复**：`"check": "vp lint & vp run typecheck && wait && vp test run"`

#### P2-E14. `env.ts` 缺少 `VITEST` 环境变量声明

- **文件**：`src/server/env.ts`、`src/server/db/migrate.ts`
- **问题**：`migrate.ts` 直接读取 `process.env.VITEST`，但该变量未在 t3-env schema 中声明。

#### P2-E15. 无 GitHub Actions CI 配置

- **问题**：项目没有 `.github/workflows/` 目录。缺乏 CI 自动化。
- **建议**：添加 `.github/workflows/ci.yml`：

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

---

## 3. 路由与数据层

### 3.1 P0 — 必须立即修复

#### P0-A1. `@/server/seo/meta` 被 `meta()` 导入 — 架构层违规

- **文件**：约 25 个路由模块（`wp-admin.*.tsx`、`home.tsx`、`post.detail.tsx`、`page.detail.tsx` 等）
- **问题**：`meta()` 在 React Router 7 中同时运行在服务端和客户端。大量路由从 `@/server/seo/meta` 导入 `bundleFromMatches` 和 `routeMeta`。虽然 `meta.ts` 自身只依赖 `@/shared/*`，但它居住在 `server/` 目录。AGENTS.md 明确禁止 client/ui 导入 server 模块。未来若有人在 `meta.ts` 中添加 server-only import（如 `drizzle-orm` 查询），会悄无声息地破坏客户端构建。
- **修复**：将 `src/server/seo/meta.ts` **迁移到 `src/shared/seo/meta.ts`**，批量更新所有导入。

#### P0-R1. `defer()` 缺失导致评论流式渲染完全失效

- **文件**：`src/routes/post.detail.tsx`（第 52–63 行）、`src/routes/page.detail.tsx`（第 40–57 行）
- **问题**：`detail.comments` 作为 `Promise` 返回，UI 层使用了 `<Suspense>` + `<Await>` 消费它，但 loader 没有使用 `defer()`，而是使用 `data()`。导致：
  - SSR 期间 React Router 在渲染前 await 所有 Promise
  - 评论数据阻塞首字节时间（TTFB）
  - `<Suspense>` 在 SSR 中永远看不到 pending 状态
- **修复**：

```typescript
// src/routes/post.detail.tsx
return defer(
  {
    post, body, visibleTags, sidebarPosts, tags, detail, imageMeta,
  },
  { headers: { 'Set-Cookie': commentCsrfSetCookie, ETag: etag } },
)
```

同理修复 `page.detail.tsx`。

### 3.2 P1 — 建议下一轮处理

#### P1-R2. Admin Settings 子布局缺少 ErrorBoundary

- **文件**：`src/routes/wp-admin.settings.layout.tsx`
- **问题**：导出了 `loader`，但没有 `ErrorBoundary`。其所有子路由（12 个设置页面）也没有自己的 ErrorBoundary。错误会冒泡到 `root.tsx` 的 ErrorBoundary，导致错误页面失去 admin 的 Tailwind 主题上下文。
- **修复**：在 `wp-admin.settings.layout.tsx` 添加 ErrorBoundary，与 `wp-admin.layout.tsx` 保持一致。

#### P1-R3. `routeMeta` / `bundleFromMatches` 在约 20+ 个 admin 路由中重复

- **文件**：约 20+ 个 admin 路由
- **问题**：每个 admin 路由复制完全相同的 `meta()` 模式：

```typescript
export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '...' }, bundleFromMatches(matches))
}
```

- **修复**：在 `wp-admin.layout.tsx` 中提供默认 meta，子路由只在需要覆盖时才导出 `meta()`。

#### P1-R4. `public.layout.tsx` 的类型断言

- **文件**：`src/routes/public.layout.tsx`
- **问题**：`useRouteLoaderData('root') as { admin?: boolean } | undefined`
- **修复**：改用 `useRouteLoaderData<typeof loader>('root')`。

### 3.3 P2 — 可选优化

#### P2-R5. `feed.rss.ts` loader 返回 Response，但 `headers` export 可能重复

- **文件**：`src/routes/feed.rss.ts`
- **问题**：`feedResponse` 已返回完整 Response，`headers()` export 可能与其重复设置 `Cache-Control`。
- **建议**：确认 `feedResponse` 是否已含 `Cache-Control`，如已含则移除 `headers` export。

#### P2-R6. `data()` vs 原始对象返回风格不一致

- **问题**：部分 loader 返回原始对象（如 `archives.tsx`、`sitemap.ts`），部分使用 `data()` 包装。不一致会让后来者困惑。
- **建议**：在 AGENTS.md 中显式约定：需要自定义 headers 时用 `data()`，不需要时返回原始对象，需要流式时用 `defer()`。

#### P2-R7. `useDetachPublicCss` 是 React Router workaround

- **文件**：`src/client/hooks/use-detach-public-css.ts`
- **建议**：在 AGENTS.md 中记录该模式的必要性，以便 React Router 修复后移除。

#### P2-R8. `listingLoader` 的 `totalPosts` 查询造成串行瀑布

- **文件**：`src/routes/category.list.tsx`、`src/routes/tag.list.tsx`
- **问题**：`findTagBySlug` / `findCategoryBySlug` 完成后才发起 `countPublicPosts`。
- **评估**：由于 count 需要 `tag.name`，当前架构下串行是合理的。但如果能通过 slug 直接查 count，可以优化。

---

## 4. 编辑器与 PortableText 层

### 4.1 P0 — 必须立即修复

#### P0-ED1. Shiki Highlighter 每次保存重复创建

- **文件**：`src/server/pt/prerender.ts`（第 152–174 行）
- **问题**：`runShikiPasses` 每次调用都 `createHighlighter({ langs: Object.keys(bundledLanguages), themes: [SHIKI_THEME] })`。Shiki highlighter 初始化需要加载全部语言 grammar，耗时 80ms+。频繁保存草稿时不可接受。
- **修复**：模块级别缓存 highlighter 实例：

```typescript
let shikiHighlighterPromise: ReturnType<typeof createHighlighter> | null = null

async function getShikiHighlighter() {
  if (shikiHighlighterPromise === null) {
    shikiHighlighterPromise = createHighlighter({
      langs: Object.keys(bundledLanguages),
      themes: [SHIKI_THEME],
    }).catch((err) => {
      shikiHighlighterPromise = null
      throw err
    })
  }
  return shikiHighlighterPromise
}

async function runShikiPasses(blocks) {
  if (blocks.length === 0) return
  let highlight = null
  try {
    const highlighter = await getShikiHighlighter()
    highlight = (code, lang) =>
      Promise.resolve(
        highlighter.codeToHtml(code, {
          lang: typeof lang === 'string' && lang !== '' && lang in bundledLanguages ? lang : 'text',
          theme: SHIKI_THEME,
          transformers: shikiTransformers(),
        }),
      )
  } catch {
    return
  }
  // ... 其余不变
}
```

#### P0-ED2. 表格内 `$...$` 输入规则导致 mathInline 内容静默丢失

- **文件**：`src/ui/admin/editor/tiptap/InlineMarks.ts`（第 35–58 行）、`src/ui/admin/editor/tiptap/table-cell-guard.ts`
- **问题**：`MathInlineMark` 的 `markInputRule` 不检查当前 selection 是否在表格单元格内。虽然 `TableCellGuardExtension` 在 paste/drop 时清理非法 marks，但输入规则完全绕过了这个防护。用户在表格中键入 `$x^2$` 会创建 `mathInline` mark；PM->PT 桥接的 `pmCellToTableCell` 会过滤掉非 `link` 的 mark def。结果是：用户输入的公式在保存后完全消失，没有任何提示。
- **修复**：在 `markInputRule` 的 `getAttributes` 中加入表格上下文检测：

```typescript
addInputRules() {
  return [
    markInputRule({
      find: mathInlineInputRegex,
      type: this.type,
      getAttributes: (match, state) => {
        const { $from } = state.selection
        for (let d = $from.depth; d > 0; d--) {
          const name = $from.node(d).type.name
          if (name === 'tableCell' || name === 'tableHeader') {
            return null // 阻止规则应用
          }
        }
        const tex = match[match.length - 1] ?? ''
        return { tex, _key: generateBlockKey() }
      },
    }),
  ]
}
```

#### P0-ED3. ImageNodeView 的 React state 与 node attrs 不同步

- **文件**：`src/ui/admin/editor/tiptap/ImageNodeView.tsx`（第 38–43 行）
- **问题**：`alt`、`caption`、`externalUrl` 使用 `useState` 初始化后不再与 `props.node.attrs` 同步。当用户执行 undo/redo、协作同步、脚本批量修改节点 attrs 时，UI 仍显示旧值。
- **修复**：使用 `useEffect` 同步 attrs -> state：

```tsx
const [alt, setAlt] = useState(attrs.alt ?? '')
useEffect(() => {
  setAlt(attrs.alt ?? '')
}, [attrs.alt])
```

同理处理 `caption`、`externalUrl`、`showExternalForm`。

#### P0-ED4. PM->PT 桥接 flatten blockquote 导致嵌套内容丢失

- **文件**：`src/shared/pt/bridge/pm-to-pt.ts`（第 54–65 行）
- **问题**：`case 'blockquote'` 遍历 `node.content` 并假设所有子节点都是 paragraph，直接调用 `paragraphToTextBlock`。但 Tiptap 的 `Blockquote` 默认 `content: 'block+'`，允许嵌套列表、代码块、标题等。如果 blockquote 内包含 bulletList，其 `listItem` 子节点不是 inline，会被 `paragraphToTextBlock` 过滤掉，导致内容完全丢失。
- **修复**：对 blockquote 递归使用 `pushPmNode`：

```typescript
case 'blockquote': {
  const textAlign = node.attrs?.textAlign as string | undefined
  const children = (node.content ?? []).filter(isBlock)
  for (const child of children) {
    if (child.type === 'paragraph') {
      out.push(
        paragraphToTextBlock(
          { ...child, attrs: { ...child.attrs, ...(textAlign ? { textAlign } : {}) } },
          ensureKey,
          'blockquote',
        ),
      )
    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
      flattenList(child, out, ensureKey, 1)
    } else {
      pushPmNode(out, child, ensureKey)
    }
  }
  return
}
```

需要补充 contract test：blockquote 内嵌列表的 round-trip。

#### P0-ED5. PageBodyEditor.tsx 过于庞大，违反单一职责

- **文件**：`src/ui/admin/editor/PageBodyEditor.tsx`（1172 行）
- **问题**：包含主编辑器组件、Toolbar 及其 10+ 个子组件（ToolbarGroup、UndoRedoGroup、BlockStyleGroup、AlignGroup、InsertsGroup、BlockStyleSelect、BlockStyleButtons、AlignSelect、DensityToggleButton、useToolbarDensityPreference 等）。违反 Vercel composition patterns 精神。
- **修复**：拆分为独立模块，零 barrel file：

```
src/ui/admin/editor/
├── PageBodyEditor.tsx          # 仅保留主 orchestration，~300 行
├── toolbar/
│   ├── Toolbar.tsx
│   ├── ToolbarGroup.tsx
│   ├── UndoRedoGroup.tsx
│   ├── BlockStyleGroup.tsx
│   ├── AlignGroup.tsx
│   ├── InsertsGroup.tsx
│   ├── BlockStyleSelect.tsx
│   ├── BlockStyleButtons.tsx
│   ├── AlignSelect.tsx
│   ├── DensityToggleButton.tsx
│   └── use-toolbar-density.ts
```

### 4.2 P1 — 建议下一轮处理

#### P1-ED6. FootnotesSection 每个 footnote 内容渲染两次

- **文件**：`src/ui/pt/render.tsx`（第 690–709 行）
- **问题**：每个 `footnoteDefinition` 都渲染了两次 `<PortableText>`：一次作为 `preview` 传入 `FootnotePreviewRegistrar`（Tooltip 悬浮预览），一次作为实际 DOM 内容。对于包含图片、音乐播放器等重量级组件的脚注，这是 2x 渲染开销。此外，`footnotesPortableComponents` 在 `map` 循环内部创建，每次父组件重渲染都是新引用。
- **修复**：
  a) 将 `footnotesPortableComponents` 提取到循环外
  b) `FootnotePreviewRegistrar` 只接受纯文本摘要：`bodyToPlainText(definition.children)`

#### P1-ED7. useEditorFootnotes 使用 JSON.stringify 进行数组比较

- **文件**：`src/ui/admin/editor/tiptap/use-editor-footnotes.ts`（第 197–201 行）
- **问题**：`JSON.stringify(nextDefs) !== JSON.stringify(footnoteDefsRef.current)` 在每次编辑器更新时执行，时间复杂度 O(n x m)，产生大量临时字符串。
- **修复**：

```typescript
function footnoteDefsEqual(a: FootnoteDefinitionBlock[], b: FootnoteDefinitionBlock[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]._key !== b[i]._key || a[i].index !== b[i].index) return false
  }
  return true
}
```

#### P1-ED8. BlockImage 模块级缓存无上限

- **文件**：`src/ui/pt/blocks/BlockImage.tsx`（第 25 行）
- **问题**：`const imageMetaBySrcCache = new Map<string, ResolvedImageMeta>()` 没有大小限制或过期策略。长会话浏览大量文章时内存无限增长。
- **修复**：

```typescript
const CACHE_LIMIT = 200
const imageMetaBySrcCache = new Map<string, ResolvedImageMeta>()

function setImageMetaCache(src: string, meta: ResolvedImageMeta): void {
  if (imageMetaBySrcCache.size >= CACHE_LIMIT && !imageMetaBySrcCache.has(src)) {
    const firstKey = imageMetaBySrcCache.keys().next().value
    if (firstKey !== undefined) {
      imageMetaBySrcCache.delete(firstKey)
    }
  }
  imageMetaBySrcCache.set(src, meta)
}
```

#### P1-ED9. MathInlinePanel apply 存在竞态和 selection 漂移风险

- **文件**：`src/ui/admin/editor/tiptap/InlineMarkPanels.tsx`（第 63–99 行）
- **问题**：`apply()` 是 async 函数，在 `await fetchRenderMath` 期间用户 selection 可能已改变。返回后直接使用 `editor.state.selection.from` 计算插入位置，可能将公式插入到错误位置。快速连续点击 Apply 会触发多次请求。
- **修复**：异步操作前保存 selection，回来后验证。

#### P1-ED10. LinkPopover useEffect 无条件聚焦导致焦点抢夺

- **文件**：`src/ui/admin/editor/tiptap/LinkPopover.tsx`（第 49–52 行）
- **问题**：`useEffect(() => { firstFieldRef.current?.focus(); firstFieldRef.current?.select(); }, [])` 在每次 mount 时聚焦。当父组件重渲染导致 `LinkPopover` remount 时，焦点被强制拉回输入框，打断用户操作。
- **修复**：`useEffect(() => { ... }, [variant])` — 只在 variant 变化时聚焦。

#### P1-ED11. SlashMenu clientRect() 每渲染帧调用

- **文件**：`src/ui/admin/editor/tiptap/SlashMenu.tsx`（第 152 行）
- **问题**：`const rect = clientRect ? clientRect() : null` 在每次渲染时同步读取 DOMRect。快速输入 `/` 后的连续字符时导致不必要的布局计算。
- **修复**：`const rect = useMemo(() => (clientRect ? clientRect() : null), [clientRect, query])`

#### P1-ED12. MathInlineMark 的 paste rule 可能误匹配货币符号

- **文件**：`src/ui/admin/editor/tiptap/InlineMarks.ts`（第 10–11 行）
- **问题**：正则 `(^|[^\\$])\\$(?!\\$)([^$\n]+)\\$(?!\\$)` 会匹配 `$100` 这样的货币文本。
- **修复**：`/(^|\s)\\$(?!\\$)([^$\n]+?)\\$(?!\\$)(?=\s|$|[.,;:!?])$/`

### 4.3 P2 — 可选优化

#### P2-ED13. render.tsx Provider 嵌套过深

- **文件**：`src/ui/pt/render.tsx`（第 190–209 行）
- **问题**：5 层 Provider 嵌套导致 JSX 深度增加，每次 `PortableTextBody` 渲染都会重新创建 provider 元素。
- **修复**：将稳定的 Provider（如 `ImageMetaProvider`）提取到页面级。

#### P2-ED14. diff 算法 BlockInlineDiff 使用不稳定 key

- **文件**：`src/ui/admin/editor/portable-text-diff.tsx`（第 300–319 行）
- **问题**：`parts.map((part, idx) => <span key={idx}>)` 使用数组索引作为 key。
- **修复**：使用内容哈希作为 key：`` `${idx}-${part.op}-${part.text.slice(0, 20)}` ``

#### P2-ED15. footnote-caret-trigger InputRule 中 `canInsertFootnoteMark` 的 editor 引用

- **文件**：`src/ui/admin/editor/tiptap/footnote-caret-trigger.ts`（第 14–28 行）
- **问题**：`canInsertFootnoteMark(editor)` 每次触发都会遍历 DOM 检查表格状态，对于快速输入场景有轻微开销。
- **评估**：当前实现通过 `editor.isActive('table')` 做了轻量检查，可接受。如需优化可缓存 `isActive` 结果。

#### P2-ED16. TableBubbleMenu 按钮链式调用缺乏错误处理

- **文件**：`src/ui/admin/editor/tiptap/TableBubbleMenu.tsx`
- **问题**：`editor.chain().focus().addRowBefore().run()` 等调用未检查 `run()` 返回值。
- **优化**：`if (!chain.run()) { /* toast 提示 */ }`

---

## 5. UI 组件与样式层

### 5.1 P0 — 必须立即修复

#### P0-UI1. Image 组件逻辑重复

- **文件**：`src/ui/primitives/Image.tsx`、`src/ui/pt/blocks/BlockImage.tsx`
- **问题**：`BlockImage` 复制了 `RawImage` 的 thumbhash 背景逻辑、ref 合并模式和 loaded 状态管理，约 80 行完全相同代码。任何 bugfix 必须应用到两个地方。
- **修复**：提取共享的 `useImageRef` hook：

```typescript
export function useImageRef(externalRef?: Ref<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)

  const setRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef && 'current' in externalRef) {
      (externalRef as React.RefObject<HTMLImageElement | null>).current = node
    }
    if (node?.complete) setLoaded(true)
  }, [externalRef])

  useLayoutEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return { ref: setRef, loaded, setLoaded }
}
```

#### P0-UI2. Popup 组件缺失 ARIA 属性

- **文件**：`src/ui/primitives/Popup.tsx`
- **问题**：Popup 作为模态对话框，缺少：
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-labelledby`
  - 焦点陷阱 / 焦点恢复
- **对比**：`Header.tsx` 正确实现了 `role="dialog"`、`aria-modal`、`aria-labelledby` 和 Escape 焦点恢复。
- **修复**：补全 ARIA 属性，接入 Base UI 的 `FocusTrap` 原语。

#### P0-UI3. MusicPlayer 使用未定义的 spacing token

- **文件**：`src/ui/pt/blocks/MusicPlayer.tsx`
- **问题**：使用了 `mb-5.5` 和 `max-w-87.5`，这两个 token 在 `tailwind.css` 的 `@theme` 中不存在，Tailwind v4 默认不生成这些 utilities。CSS 静默失效。
- **代码**：`'mt-5 mb-5.5 max-w-87.5 max-xl:mx-auto max-md:mx-0 max-md:mt-0 max-md:mb-5 max-md:max-w-full'`
- **修复**：在 `@theme inline` 中注册：

```css
@theme inline {
  --spacing-5\.5: 1.375rem;
  --spacing-87\.5: 21.875rem;
}
```

或在 `cn.ts` 中注册并替换为 `mb-[1.375rem] max-w-[350px]`。

### 5.2 P1 — 建议下一轮处理

#### P1-UI4. Arbitrary Values 应成为 Design Tokens

- **文件**：`Tooltip.tsx`、`Header.tsx`、`Sidebar.tsx`、`PostListViews.tsx`、`Solution.tsx` 等
- **问题**：大量组件使用 arbitrary values，破坏设计系统一致性：

| 文件 | Arbitrary Value | 应成为 |
|------|----------------|--------|
| `Tooltip.tsx:39` | `z-[1080]` | `--z-tooltip: 1080` |
| `Tooltip.tsx:39` | `text-[0.8125rem]` | `--text-tooltip: 0.8125rem` |
| `Tooltip.tsx:39` | `leading-[1.6]` | `--leading-tooltip: 1.6` |
| `Header.tsx:48` | `lg:w-[220px]` | `--width-sidebar: 220px` |
| `Header.tsx:48` | `xl:w-[260px]` | `--width-sidebar-xl: 260px` |
| `Sidebar.tsx:139` | `xl:w-[29%]` | Grid system 或 token |
| `PostListViews.tsx:51` | `xl:w-[71%]` | Grid system 或 token |
| `Solution.tsx:9` | `p-[1.2rem]` | `--spacing-solution: 1.2rem` |
| `Solution.tsx:10` | `text-[1.2rem]` | `--text-solution: 1.2rem` |

- **修复**：添加到 `tailwind.css` 的 `@theme inline` 块，并在 `cn.ts` 中注册。

#### P1-UI5. cn.ts 缺失 Container 和 Z-Index Token 注册

- **文件**：`src/ui/lib/cn.ts`
- **问题**：`tailwind.css` 定义了 `--container-popup-sm/md/lg` 和 `--z-aside-drawer/modal`，但 `cn.ts` 未在 `extendTailwindMerge` 中注册这些 namespace。若组件同时组合 `max-w-popup-sm` 与另一个 `max-w-*`，`tailwind-merge` 会错误去重。
- **修复**：

```typescript
const CONTAINER_TOKENS = ['popup-sm', 'popup-md', 'popup-lg'] as const
const Z_INDEX_TOKENS = ['aside-drawer', 'modal'] as const

const customTwMerge = extendTailwindMerge({
  extend: {
    theme: {
      container: [...CONTAINER_TOKENS],
      // zIndex 注册视 tailwind-merge 支持情况而定
    },
  },
})
```

#### P1-UI6. DetailBodyChrome 拥有过多 Props

- **文件**：`src/ui/post/DetailBodyChrome.tsx`
- **问题**：接受 20+ 个 props，包括多个配置 boolean（`showUpdated`、`toc`、`commentsEnabled`、`admin`）和 slot props（`metaExtra`、`afterLikeButton`）。编排过重。
- **修复**：拆分为 Compound Components：

```tsx
<DetailBodyChrome>
  <DetailBodyChrome.Title marker={draftMarker}>{title}</DetailBodyChrome.Title>
  <DetailBodyChrome.Meta date={date} updated={updated} />
  <DetailBodyChrome.Toc headings={headings} enabled={post.toc} />
  <DetailBodyChrome.Content ref={postContentRef}>{children}</DetailBodyChrome.Content>
  <DetailBodyChrome.Likes permalink={permalink} likes={likes} />
  <DetailBodyChrome.Comments enabled={post.comments}>...</DetailBodyChrome.Comments>
</DetailBodyChrome>
```

#### P1-UI7. PostListViews Grid 使用 Magic Number 百分比

- **文件**：`src/ui/post/post/PostListViews.tsx`、`src/ui/sidebar/Sidebar.tsx`
- **问题**：`xl:w-[71%]` 和 `xl:w-[29%]` 是 brittle 魔法数字，不对应标准 grid 分数。
- **修复**：使用 Tailwind grid 系统：

```tsx
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
  <div className="xl:col-span-8">{/* main */}</div>
  <div className="xl:col-span-4">{/* sidebar */}</div>
</div>
```

或提取为 CSS 变量：`--layout-main-ratio: 71%` / `--layout-sidebar-ratio: 29%`。

#### P1-UI8. shadcn/ui 基于 Base UI 存在升级风险

- **文件**：`components.json`、`src/ui/components/*.tsx`
- **问题**：使用 `style: "base-vega"` 和 `@base-ui/react` 而非标准 Radix UI。Base UI 是 newer 项目，API 仍在稳定化。自定义组件使用 Base UI 特定 API（`useRender`、`data-[starting-style]`、`data-[ending-style]`）。
- **修复**：在 `AGENTS.md` 中记录此架构决策。`package.json` 中锁定 `@base-ui/react` 精确版本。

#### P1-UI9. SearchBar Label 缺失 htmlFor

- **文件**：`src/ui/search/Search.tsx`
- **问题**：`<label>` 使用 `aria-label` 但无 `htmlFor`。虽然嵌套输入创建隐式关联，但 `aria-label` 在 label 上冗余。
- **修复**：

```tsx
<label htmlFor="search-input" className="sr-only">文章寻踪</label>
<input id="search-input" type="search" ... />
```

#### P1-UI10. CommentItem 同时暴露 Boolean Props 和 Context

- **文件**：`src/ui/comments/CommentItem.tsx`
- **问题**：`CommentItem` 接受 `admin?: boolean` 和 `pending?: boolean` props，但 `CommentsContext` 已提供 `admin`。造成两个 truth source。
- **修复**：移除 prop-level overrides，标准化为 context-only。

### 5.3 P2 — 可选优化

#### P2-UI11. CodeBlock LANGUAGE_MAP 膨胀组件文件

- **文件**：`src/ui/pt/blocks/CodeBlock.tsx`
- **问题**：145 条目的 `LANGUAGE_MAP` 字典（~120 行非 React 代码）存在于组件文件中。
- **修复**：提取到 `src/ui/lib/code-languages.ts`。

#### P2-UI12. FeaturePost 和 PostSquare 重复 Overlay 逻辑

- **文件**：`src/ui/post/post/PostListViews.tsx`
- **问题**：两者实现相同的 hover overlay：

```tsx
<div className="absolute inset-0 size-full bg-surface-secondary/60 opacity-60 transition-opacity duration-300 ease-in-out group-hover:opacity-[0.22]" />
```

- **修复**：提取 `PostCardOverlay` 组件。

#### P2-UI13. BlockImage 使用原生 fetch 而非 useApiFetcher

- **文件**：`src/ui/pt/blocks/BlockImage.tsx`
- **问题**：使用原生 `fetch()` 解析 thumbhash，而非项目标准的 `useApiFetcher`。
- **评估**：虽然避免了向非交互组件引入 hook，但可以考虑提取共享的 `useImageMetaFetch`。

#### P2-UI14. cn.ts 的 Token 契约测试

- **文件**：`tests/contract.tailwind-tokens.test.ts`
- **现状**：已有 `__TOKENS_FOR_TESTS` 机制确保 token 注册与 CSS 同步。
- **建议**：保持并扩展该测试以覆盖新添加的 token namespace。

---

## 6. 长期架构演进方向

> 以下建议不在 P0/P1/P2 行动清单中，属于 6 个月到 1 年的架构演进方向。

### LA1. 编辑器状态源统一 — 消除"双数据源"

- **现状**：`useEditorFootnotes` 将脚注定义存储在 React state 中，与 ProseMirror doc 分离。
- **问题**：双数据源增加心智负担，undo/redo 与脚注列表同步容易出错。
- **长期方案**：将脚注完全建模为 PM doc 中的节点（自定义 `footnoteDefinition` PM node），通过 NodeView 隐藏视觉呈现，统一状态源。

### LA2. Bridge 类型安全 — 从 `Record<string, unknown>` 到严格接口

- **现状**：`PmNode`、`PmBlockNode` 的 attrs 使用宽松的 `Record<string, unknown>`。
- **问题**：桥接错误在运行时才暴露（如 blockquote 嵌套丢失就是类型不严格导致的）。
- **长期方案**：为每个节点类型引入严格 attrs 接口：

```typescript
type PmImageNode = { type: 'image'; attrs: { src: string; alt?: string; caption?: string } }
type PmCodeBlock = { type: 'codeBlock'; attrs: { language?: string } }
```

### LA3. Pre-render 块级指纹缓存

- **现状**：`prerenderPortableTextBody` 每次保存全量遍历整个 body，重新渲染所有块。
- **长期方案**：引入块级指纹 `hash(block._key + block.code + block.language)`，只渲染真正变化的块。

### LA4. Tiptap Extension 按功能域重组目录

- **现状**：所有 custom extensions 散落在 `tiptap/` 平级目录。
- **长期方案**：

```
src/ui/admin/editor/tiptap/
├── marks/         # MathInlineMark, FootnoteRefMark
├── nodes/         # ImageNode, BlockCardNode, SolutionNode, TwoColumnNode
├── menus/         # BubbleMenu, TableBubbleMenu, SlashMenu
└── guards/        # TableCellGuardExtension, FootnoteCaretTriggerExtension
```

### LA5. Settings Context 保持切片模式（已部分实现，需长期维护）

- **现状良好**：当前已使用 per-section context（`useSiteIdentity`、`useCommentsSettings` 等）。
- **需警惕**：未来不要重新引入聚合的 `useBlogSettingsBundle()`，这是 AGENTS.md 中明确禁止的反模式。

### LA6. 评论系统从 Promise 模式迁移到真正的流式 SSR

- **现状**：`defer()` 修复后启用流式，但评论数据仍是 loader 内部创建的 Promise。
- **长期方案**：考虑将评论数据获取真正异步化（如独立 resource route），让首屏 HTML 更小。

---

## 7. 执行时间线建议

### Phase 1 — 本周（P0 全部修复）

| 任务 | 文件 | 估计工作量 |
|------|------|-----------|
| 将 `aplayer-ts`/`medium-zoom`/`qrcode.react` 移到 `dependencies` | `package.json` | 5 min |
| 启用 `v8_splitRouteModules` | `react-router.config.ts` | 5 min |
| 修复 `logger.ts` 读 `process.env` | `src/server/logger.ts` | 10 min |
| 迁移 `meta.ts` 到 `shared/` | `src/server/seo/meta.ts` + ~25 个导入 | 30 min |
| 为 `post.detail.tsx` / `page.detail.tsx` 添加 `defer()` | 2 个路由文件 | 15 min |
| Shiki Highlighter 模块级缓存 | `src/server/pt/prerender.ts` | 20 min |
| 表格内 mathInline 输入规则防护 | `src/ui/admin/editor/tiptap/InlineMarks.ts` | 20 min |
| ImageNodeView state 同步 | `src/ui/admin/editor/tiptap/ImageNodeView.tsx` | 15 min |
| blockquote 桥接递归处理 | `src/shared/pt/bridge/pm-to-pt.ts` | 30 min |
| 拆分 PageBodyEditor.tsx | `src/ui/admin/editor/PageBodyEditor.tsx` | 2 h |
| Popup ARIA 补全 | `src/ui/primitives/Popup.tsx` | 30 min |
| MusicPlayer token 修复 | `src/ui/pt/blocks/MusicPlayer.tsx` + `tailwind.css` | 10 min |
| Image 逻辑提取共享 hook | `src/ui/primitives/Image.tsx` + `BlockImage.tsx` | 30 min |

### Phase 2 — 下周（P1 工程规范 + barrel 清理）

| 任务 | 文件 | 估计工作量 |
|------|------|-----------|
| 清理 `src/server/catalog/index.ts` barrel | ~15 个导入点 | 1 h |
| 删除 `src/server/db/types/index.ts` | 27 个导入点替换 | 1 h |
| 清理 `src/shared/pt/bridge/index.ts` barrel | 7 个导入点 | 30 min |
| Dockerfile 改为 `node:22-alpine` | `Dockerfile` | 5 min |
| 开启 oxlint `no-unsafe-type-assertion` | `oxlint.config.ts` | 15 min |
| 添加 Vite `manualChunks` | `vite.config.ts` | 30 min |
| 精确化 coverage 排除规则 | `vite.config.ts` | 20 min |
| Admin settings ErrorBoundary | `wp-admin.settings.layout.tsx` | 20 min |
| 提取 admin 默认 meta | `wp-admin.layout.tsx` + ~20 个子路由 | 1 h |

### Phase 3 — 下一轮迭代（P1 UI/编辑器 + P2 优化）

| 任务 | 领域 |
|------|------|
| arbitrary values -> design tokens | UI/样式 |
| cn.ts 补全 container/z-index 注册 | UI/样式 |
| DetailBodyChrome -> Compound Components | UI/组件 |
| 71/29 魔法数字 -> grid system | UI/布局 |
| footnote 渲染优化（2x -> 1x） | 编辑器 |
| JSON.stringify -> 自定义比较 | 编辑器 |
| BlockImage LRU 缓存 | 编辑器 |
| MathInlinePanel 竞态修复 | 编辑器 |
| LinkPopover 焦点修复 | 编辑器 |
| Base UI 升级风险文档 | 工程规范 |

### Phase 4 — 长期（6个月+）

| 任务 | 领域 |
|------|------|
| 编辑器状态源统一（PM doc 单一 truth） | 编辑器架构 |
| Bridge 严格类型接口 | 类型安全 |
| Pre-render 块级指纹缓存 | 性能 |
| Tiptap Extension 目录重组 | 代码组织 |
| 评论系统真正异步化 | 数据流 |

---

## 8. 验证清单

修复完成后运行：

```bash
# 1. 类型、格式、lint
vp check

# 2. 边界与契约测试
vp test run tests/contract.boundaries.test.ts
vp test run tests/contract.pt-bridge.test.ts
vp test run tests/contract.tailwind-tokens.test.ts
vp test run tests/contract.cookie.test.ts

# 3. 构建验证
vp build

# 4. Docker 构建验证
docker build -t yufan-me:test . && docker run --rm yufan-me:test ls build/client/assets | grep -E '(aplayer|medium-zoom|qrcode)'
```

手动验证：

- [ ] 表格内输入 `$x^2$` 不创建 mathInline mark
- [ ] Image block 的 alt/caption 在 undo/redo 后同步更新
- [ ] Blockquote 内嵌列表保存后内容不丢失
- [ ] 保存含代码块的文章时 Shiki 不重新初始化（`console.time` 验证）
- [ ] 生产 Docker 构建后 aplayer-ts / medium-zoom / qrcode.react chunk 存在
- [ ] Popup 打开后 Tab 焦点被限制在弹窗内
- [ ] MusicPlayer 的 `mb-5.5` 和 `max-w-87.5` 正确渲染
- [ ] 页面流式渲染时评论 Suspense fallback 可见
- [ ] meta.ts 迁移后客户端导航的 `<title>` 正确更新
- [ ] oxlint `no-unsafe-type-assertion` 开启后无新增错误

---

> 本报告由 4 个并行 Agent 分别审计工程规范、路由数据层、编辑器/PortableText 层、UI 组件与样式层后整合生成。
