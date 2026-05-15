# 架构审计报告：Hono + ts-rest 迁移后质量评估

> 审计日期：2026-05-15  
> 审计范围：`src/server/http/`、`src/shared/contracts/`、`src/client/api/`、`src/server.ts` 及全部 Controller 实现  
> 审计方法：静态代码分析 + 类型系统验证 + 运行时行为推演

---

## 执行摘要

本次迁移在**功能交付层面**已完成，但**工程质量和类型安全层面**存在系统性缺口。核心矛盾在于：**ts-rest 的契约类型系统被设计得很完善，却在挂载层、Controller 层、Adapter 层被连续击穿**，导致契约与实际实现之间没有任何编译期约束。

**关键指标：**

| 维度 | 现状 | 期望 |
|---|---|---|
| Admin Controller 类型覆盖率 | **0%**（全部 `args: any, ctx: any`） | 100% `ContractImpl<typeof contract>` |
| Admin 契约 schema 精度 | **0%**（全部 `z.any()`） | 精确 Zod schema |
| Controller `as any` 数量 | **19 处**（含 `app.ts` 15 处） | 0 处 |
| 错误处理一致性 | **3 种风格并存**（return/DomainError/ActionFailure） | 1 种风格 |
| 未处理异常类 | `ActionFailure` 被全局忽略 | 全部收敛到 `onErrorHandler` |
| 未鉴权端点 | `renderMath`、`renderMermaid` | 全部受 Guard 保护 |

---

## P0 — 严重（阻塞生产或导致数据/安全故障）

### P0.1 `ActionFailure` 被全局错误处理器忽略，导致所有 4xx 业务错误变成 500

**位置：** `src/server/http/errors.ts`

`comment.controller.ts`（以及遗留 service 层）在 8 个以上位置抛出 `ActionFailure`：

```ts
// src/server/http/controllers/comment.controller.ts
throw new ActionFailure(404, '评论目标不存在')
throw new ActionFailure(409, '您已经点过赞了')
```

但 `onErrorHandler` 只处理了 `HTTPException` 和 `DomainError`，没有 `ActionFailure` 分支：

```ts
// src/server/http/errors.ts
export function onErrorHandler(err: unknown, c: Context<Env>): Response {
  if (err instanceof HTTPException) { /* ... */ }
  if (err instanceof DomainError) { /* ... */ }
  // ❌ ActionFailure falls through here
  return c.json({ error: { message: '服务器内部错误' } }, 500)
}
```

**影响：** 用户点赞冲突看到"服务器内部错误"而非"您已经点过赞了"；评论目标不存在返回 500 而非 404。监控和日志无法区分真正的系统故障与预期业务异常。

**修复：** 在 `onErrorHandler` 中添加 `ActionFailure` 分支，或（更优）将所有 `ActionFailure` 调用重构为显式 `{ status, body }` 返回，并逐步删除 `ActionFailure` 类。

---

### P0.2 `renderMath` / `renderMermaid` 端点完全没有鉴权

**位置：** `src/server/http/controllers/admin/renders.controller.ts`

```ts
export const adminRendersController = {
  renderMath: async (args: any, ctx: any) => {
    // ❌ 没有任何 session/role 检查
    const { body } = args
    return { status: 200, body: await renderMathBlock(body.content) }
  },
  renderMermaid: async (args: any, ctx: any) => {
    // ❌ 没有任何 session/role 检查
    const { body } = args
    return { status: 200, body: await renderMermaidDiagram(body.content) }
  },
  reindexSearch: async (args: any, ctx: any) => {
    // ✅ 有鉴权
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403, ... }
    ...
  },
}
```

虽然这两个端点被 `adminRoute()` 挂载（见 `app.ts`），但 `adminRoute` 只注入 `requireRoleMw('admin')` middleware。然而，**Controller 内部的鉴权缺失意味着如果未来有人把这两个端点误挂载到 `publicRoute`，它们将完全暴露**。更关键的是，`renderMath` 调用 KaTeX 进行服务端渲染，可能被用于拒绝服务攻击（构造极端复杂的数学公式消耗 CPU）。

**修复：** 在 `renderMath` 和 `renderMermaid` handler 中添加与 `reindexSearch` 一致的角色检查；或者将鉴权逻辑下沉到 service 层，确保任何入口点都受保护。

---

### P0.3 ts-rest Adapter 的 multipart 解析完全损坏

**位置：** `src/server/http/ts-rest-adapter.ts:126-129`

```ts
async function readBody(req: Request, route: AppRoute): Promise<unknown> {
  if (ct.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    return Object.fromEntries(fd.entries()) // ❌ 严重错误
  }
}
```

`Object.fromEntries(fd.entries())` 会：
1. **丢失重复字段名**（只保留最后一个）。
2. **将 `File` 对象转换为字符串**——`File` 被 `toString()` 后变成 `"[object File]"`，导致文件上传完全不可用。

**影响：** 如果任何 Controller 试图通过 ts-rest adapter 接收 multipart 上传（如 `UploadImageDialog` 的 `/api/admin/upload-image`），文件内容会在 adapter 层被静默破坏。

**修复：** 对于 multipart 路由，绕过 `readBody` 的 JSON/FormData 解析，直接将 `req.formData()` 的 `FormData` 对象作为 `body` 传给 handler，让 handler 自己处理文件提取。

---

### P0.4 所有 Controller 在 `app.ts` 中被 `as any` 挂载，契约类型检查完全失效

**位置：** `src/server/http/app.ts`

```ts
authedRoute(app, apiContract.account, accountController as any)
publicRoute(app, apiContract.comment, commentController as any)
adminRoute(app, adminUsersContract, adminUsersController as any)
// ... 重复 15 次
```

`mountContract` 的签名要求 `impl: ContractImpl<R>`，但 `app.ts` 的每一次调用都 cast 成了 `any`。这意味着：
- Controller 缺少某个 endpoint → **编译通过**。
- Controller 返回了契约未声明的状态码（如 201 而非 200）→ **编译通过**。
- Controller 的 body 形状与契约 responses 不匹配 → **编译通过**。

整个 ts-rest 类型系统的核心价值被一笔勾销。

**修复：** 移除所有 `as any`。对于 `adminRoute`/`publicRoute` 等工厂函数，需要确保它们的泛型签名正确传递 `ContractImpl<R>` 约束，并且 Controller 对象本身标注 `satisfies ContractImpl<typeof ...Contract>`。

---

## P1 — 高优先级（显著降低可维护性或引入隐蔽 Bug）

### P1.1 Admin Controller 层：100% 的类型弃权

**位置：** `src/server/http/controllers/admin/*.controller.ts`（全部 13 个文件）

每个 Admin Controller 都遵循以下反模式：

```ts
// admin/posts.controller.ts
import type { ContractImpl } from '@/server/http/ts-rest-adapter'  // ✅ 导入了

export const adminPostsController = {  // ❌ 没有标注类型
  listPosts: async (args: any, ctx: any) => {  // ❌ 双 any
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const result = await listPostsForAdmin(
      { q: args.query.q, deletedStatus: args.query.deletedStatus, ... },  // ❌ 无类型提示
      ctx.viewer,
    )
    return { status: 200 as const, body: result }
  },
  // ... 重复 10 次
}
```

**统计：**
- 13 个 admin controller 文件，**全部**导入 `ContractImpl` 但**从未使用**。
- 61 个 admin endpoint handler，**全部**使用 `args: any, ctx: any`。
- ~8 个文件导入 dead Zod schema（如 `deletePostSchema`、`getPostSchema`），这些 schema 在文件中**零引用**。

**修复：** 逐文件添加 `satisfies ContractImpl<typeof adminXxxContract>`，然后将 `args: any` 替换为解构后的精确类型。由于契约本身目前也是 `z.any()`（见 P1.2），这两件事需要**一起修复**。

---

### P1.2 Admin 契约层：126 个 `z.any()`，Admin 端点 0% Schema 覆盖

**位置：** `src/shared/contracts/admin/*.ts`

```ts
// admin/posts.ts
export const adminPostsContract = c.router({
  listPosts: {
    method: 'GET',
    path: '/admin/posts',
    query: z.any(),           // ❌ 应是 listPostsQuery
    responses: {
      200: z.any(),           // ❌ 应是 listPostsResponse
      ...standardMutationErrors,  // ❌ GET 端点不应 spread mutation errors
    },
  },
  savePostDraft: {
    method: 'POST',
    path: '/admin/posts/:id/drafts',
    body: z.any(),            // ❌ 应是 savePostBodySchema
    responses: { 200: z.any(), ...standardMutationErrors },
  },
  // ...
}, { strictStatusCodes: true })
```

**统计：**
- 126 个 `z.any()` 占位符，1 个 `z.unknown()`。
- 所有 13 个 admin 契约文件都 import `standardReadErrors` 但**从未使用**；所有 GET 端点错误地 spread `standardMutationErrors`。
- `comment.ts` 有 10 个 `z.any()`（主要在 `comments` 数组和 `pages` 数组）。
- `music.ts` 有 1 个（`music: z.any()`）。
- `account.ts` 有 1 个 `z.unknown()`。

**影响：** 契约层丧失了输入校验和输出校验能力。adapter 的 `validate()` 函数遇到 `z.any()` 直接透传，任何畸形请求都会打到 service 层才报错，错误反馈延迟且不一致。

**修复：** 用精确的 Zod schema 替换所有 `z.any()`。对于共享的 DTO shape，应在 `shared/contracts/_types.ts` 中定义可复用的 schema 片段（目前 `_types.ts` 是空文件）。

---

### P1.3 权限检查逻辑在 60+ 处被复制粘贴

**位置：** 所有 admin controller 的每一个 handler

```ts
// 模式 A：严格 admin（~40 处）
const sessionUser = userSession(ctx.session)
if (sessionUser?.role !== 'admin') return { status: 403, body: { error: { message: '权限不足' } } }

// 模式 B：admin 或 author（~20 处）
const sessionUser = userSession(ctx.session)
if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
  return { status: 403, body: { error: { message: '权限不足' } } }
```

**问题：**
1. **单一职责原则 violation**：Controller 应该只负责编排 service 调用，鉴权应该在 Guard middleware 中完成。
2. **维护风险**：如果未来增加 `editor` 角色，需要修改 60+ 处代码。
3. **信任问题**：`authorRoute` middleware 已经保证 `hasAtLeast(role, 'author')`，但 Controller 仍然重复检查，说明 Controller 作者不相信 Guard 层。

**修复：** 删除 Controller 内的所有手动鉴权逻辑。`ctx.viewer` 由 Guard middleware 保证存在且已授权，Controller 直接使用 `ctx.viewer` 即可。如果需要区分 "admin 专用" 和 "author 可用" 的端点，应在契约挂载时（`app.ts`）通过 `adminRoute` vs `authorRoute` 区分，而不是在 Controller 内。

---

### P1.4 `unwrap.ts` 的 `any`  cast 与硬编码错误 envelope

**位置：** `src/client/api/unwrap.ts`

```ts
export async function unwrap<T extends { status: number; body: unknown }>(
  promise: Promise<T>,
): Promise<Extract<T, { status: 200 | 201 | 204 }>['body']> {
  const res = await promise
  if (res.status >= 200 && res.status < 300) {
    return (res as any).body  // ❌ 不必要的 any
  }
  const body = res.body as { error?: { message?: string; issues?: ... } } | undefined  // ❌ 硬编码
  throw new ApiError(body?.error?.message ?? '请求失败', res.status, body?.error?.issues)
}
```

**问题：**
1. `(res as any).body` 完全没必要——`res` 已经有 `body: unknown`。
2. 错误体的 shape 是硬编码字符串匹配，而非从契约的 error response schema 推导。如果服务器把 `error.issues` 改名为 `error.details`，客户端编译期**完全无感知**。
3. 2xx 范围只认 200/201/204。如果契约定义了 `202 Accepted` 或 `206 Partial Content`，`unwrap` 会把它当错误抛出。

**修复：** 使用 ts-rest 的 `ClientInferResponseBody` 和 `ClientInferRequestBody` 来推导类型；错误体类型应从契约的 `responses[4xx]` schema 推导。

---

### P1.5 资源路由（feed/images/sitemap）绕过全局错误处理器

**位置：** `src/server.ts`

```ts
app.route('/', createApiApp())      // ✅ 内部有 onErrorHandler
app.route('/', feedRouter)          // ❌ 无自定义 error handler
app.route('/', imagesRouter)        // ❌ 无自定义 error handler
app.route('/', sitemapRouter)       // ❌ 无自定义 error handler
```

`createApiApp()` 设置了 `app.onError(onErrorHandler)`，但三个资源路由器是直接挂载在根 Hono app 上的，它们内部没有 `onError`。当 `feedResponse()`、`buildSitemapXml()` 或 `drawOpenGraph()` 抛出异常时，Hono 的默认处理器返回无结构的 HTML 错误页，同时丢失了 `X-Request-Id` 和结构化日志。

**修复：** 将 `onErrorHandler` 提升到 `server.ts` 的根 app 级别，或者为每个资源 router 单独设置 `onError`。

---

### P1.6 SSE 端点存在背压缺失和竞态条件

**位置：** `src/server/http/app.ts:58-135`

```ts
const interval = setInterval(async () => {
  try {
    const rows = await queryRealtimeTail(lastSeen)
    // ...
    lastSeen = new Date() // ❌ 闭包变量，interval 回调可能重叠
  } catch {
    // Transient DB error → swallow
  }
}, POLL_INTERVAL_MS)
```

**问题：**
1. **`setInterval` 不等待前一次完成**：如果 `queryRealtimeTail` 耗时超过 2 秒，多个查询会并发执行，消耗数据库连接池。
2. **`lastSeen` 竞态**：两个重叠的回调可能读取相同的 `lastSeen`，导致重复事件推送。
3. **静默 swallow**：任何数据库故障都被吞掉，没有日志、没有 metric、没有客户端错误通知。如果数据库永久不可达，客户端看到一个永远打开但无数据的 SSE 连接。
4. **`abort` listener未移除**：`c.req.raw.signal.addEventListener('abort', ...)` 添加的监听器在连接正常关闭后不会移除。

**修复：** 改用 `setTimeout` 递归模式（等待前一次完成后再调度下一次）；为 `lastSeen` 的读写加互斥；为异常添加 `logger.warn`；在 `abort` 回调中调用 `clearTimeout` 并 `removeEventListener`。

---

### P1.7 OpenAPI 文档路径与实际路由不匹配

**位置：** `src/shared/contracts/index.ts` + `src/server/http/openapi.ts`

```ts
// index.ts
export const apiContract = c.router({
  comment: commentContract,
  // ...
}, { pathPrefix: '/api' })
```

```ts
// server.ts
app.route('/', createApiApp())  // 实际路由是 /comment/likes，不是 /api/comment/likes
```

`@ts-rest/open-api` 会把 `pathPrefix: '/api'` 包含在生成的 operation path 中，导致 Swagger UI 显示 `/api/comment/likes`，而真实端点是 `/comment/likes`。直接通过 Swagger UI 的 "Try it out" 功能会 404。

**修复：** 从 `apiContract` 的聚合中移除 `pathPrefix: '/api'`，改为在 `server.ts` 或 `app.ts` 中通过 Hono 的 `app.basePath('/api')` 来统一加前缀。这样契约本身描述的是相对路径，OpenAPI 生成器也不会多生成 `/api` 前缀。

---

## P2 — 中优先级（技术债务，影响开发效率和长期维护）

### P2.1 `comment.controller.ts` 混用三种错误风格

同一个 Controller 中同时存在：

```ts
// 风格 A：显式返回（推荐）
if (!viewer) return { status: 401, body: { error: { message: '未登录' } } }

// 风格 B：抛 DomainError
throw new DomainError('RATE_LIMITED', '点赞过于频繁')

// 风格 C：抛 ActionFailure（已被全局忽略，见 P0.1）
throw new ActionFailure(404, '评论目标不存在')
```

**修复：** 统一为风格 A（显式返回）。`DomainError` 可以保留作为 service 层的通用异常，但 Controller 作为 HTTP 适配层应该只做 `{ status, body }` 映射。`ActionFailure` 应被完全淘汰。

---

### P2.2 `admin/users.ts` 的 `getUser` 用 POST + body 传 ID

**位置：** `src/shared/contracts/admin/users.ts`

```ts
getUser: {
  method: 'POST',           // ❌ 应是 GET
  path: '/admin/users/:id', // 路径有 :id，但...
  body: z.any(),            // ...实际用 body 传 userId
}
```

Controller 实现：
```ts
getUser: async (args: any, ctx: any) => {
  const payload = args.body  // ❌ 读取 body.userId
  const user = await fetchAdminUserDto(BigInt(payload.userId))
}
```

这违反了 REST 语义：获取单个资源应该用 `GET /admin/users/:id`，参数通过 `pathParams` 传递。

**修复：** 改为 `method: 'GET'`，`pathParams: z.object({ id: z.string().min(1) })`，`args.params.id`。

---

### P2.3 客户端仍有 4 处 raw `fetch()` 绕过 ts-rest

```ts
// src/ui/admin/settings/SearchForm.tsx
await fetch('/api/admin/reindex-search', { method: 'POST', ... })

// src/ui/admin/shared/UploadImageDialog.tsx
await fetch('/api/admin/upload-image', { method: 'POST', body: formData })

// src/ui/pt/blocks/BlockImage.tsx
fetch(`/api/image/thumbhash?src=${encodeURIComponent(src)}`).catch(() => undefined)

// src/client/api/music.ts
await fetch(`/api/music/get?id=${encodeURIComponent(id)}`, ...)
```

前两个（reindex-search、upload-image）对应的是契约中已定义的端点，但客户端选择不走 `api` client。后两个（thumbhash、music get）是 GET 查询，完全可以走 ts-rest client 的 `api.image.thumbhash(...)` 和 `api.music.get(...)`。

**修复：** 将所有 raw `fetch()` 替换为 `unwrap(api.xxx.yyy(...))`。对于 multipart 上传，ts-rest client 支持 `FormData` body（只需在调用时不设置 `Content-Type` header，让浏览器自动设置 multipart boundary）。

---

### P2.4 TanStack Query 缺乏查询键工厂（Query Key Factory）

**位置：** 全部 18 个使用 `useApiQuery` 的文件

查询键是手写字符串数组，没有统一规范：

```ts
// PostsView.tsx
useApiQuery(['admin', 'posts', q, deletedStatus, ...], ...)

// ImagesView.tsx
useApiQuery(['admin', 'images', page, limit], ...)

// Analytics
useApiQuery(['analytics', 'metrics', period], ...)
```

**风险：** 手动维护查询键容易出错，且没有统一的 invalidation 策略。例如删除一篇文章后，需要知道要 `invalidateQueries` 哪些键——现在全靠开发者记忆。

**修复：** 引入查询键工厂模式：

```ts
// src/client/api/keys.ts
export const queryKeys = {
  admin: {
    posts: (filters: ListPostsQuery) => ['admin', 'posts', filters] as const,
    images: (page: number, limit: number) => ['admin', 'images', { page, limit }] as const,
  },
  analytics: {
    metrics: (period: string) => ['analytics', 'metrics', period] as const,
  },
}
```

---

### P2.5 `CommentsView.tsx` 的类型漂移 cast

**位置：** `src/ui/admin/comments/CommentsView.tsx:83`

```ts
const loadMutation = useApiMutation<LoadAllInput, LoadAllOutput>(
  (input) => unwrap(api.comment.loadAll({ body: input })) as Promise<LoadAllOutput>,
  ...
)
```

`as Promise<LoadAllOutput>` 说明契约返回类型与 `LoadAllOutput` 不匹配。这是契约 schema 精度不足（`z.any()`）的直接后果。

**修复：** 收紧契约的 `loadAll` response schema 后，移除 `as Promise<LoadAllOutput>`。

---

### P2.6 资源路由器响应风格不一致

| Router | 风格 | 是否保留 upstream headers |
|---|---|---|
| `feedRouter` | `return new Response(xml, { headers })` | ❌ 丢失 |
| `imagesRouter` | `return pngResponse()` / `Response.redirect()` | ❌ 丢失 |
| `sitemapRouter` | `c.header(...) + c.body(...)` | ✅ 保留 |

**修复：** 统一为 Hono 的 `c.header()` / `c.body()` 模式，确保 `X-Request-Id` 等上游 middleware 设置的 header 不被丢弃。

---

### P2.7 `z.stringbool()` 是非标准 Zod 方法

**位置：** `src/server/env.ts:30`

```ts
ANALYTICS_TRACK_ADMIN: z.stringbool().default('false'),
```

`z.stringbool()` 不是 Zod 内置方法。它依赖于某个全局 monkey-patch 或 Zod 扩展。如果扩展文件未加载或加载顺序错误，`createEnv` 会在模块初始化时抛出 `TypeError: z.stringbool is not a function`。

**修复：** 使用标准 Zod 组合：`z.enum(['true', 'false']).transform(v => v === 'true').default('false')`，或 `z.string().transform(v => v === 'true').default('false')`。

---

## P3 — 低优先级（优化项和代码异味）

### P3.1 Posts vs Pages 契约命名不一致

```ts
// admin/posts.ts
savePostDraft: { path: '/admin/posts/:id/drafts', ... }
publishPostLatest: { path: '/admin/posts/:id/publish', ... }

// admin/pages.ts
saveDraft: { path: '/admin/pages/:id/drafts', ... }      // ❌ 缺少 "Page" 前缀
publishLatest: { path: '/admin/pages/:id/publish', ... } // ❌ 缺少 "Page" 前缀
```

**修复：** 统一命名：`savePageDraft` / `publishPageLatest`。

---

### P3.2 Admin comment 端点分散在两个契约文件中

`approve`、`delete`、`edit`、`loadAll` 等管理操作在 `comment.ts`（域契约）中，而 `approveCommentDeletion`、`listPendingDashboard` 在 `admin/comments.ts` 中。这导致 admin comment 的权限矩阵需要在两个文件中交叉阅读。

**修复：** 将所有 admin-only 的 comment 操作迁移到 `admin/comments.ts`。

---

### P3.3 `buildRouteContexts(c as any)`

**位置：** `src/server.ts:64`

```ts
const { session, request } = buildRouteContexts(c as any)
```

`react-router-hono-server` 传递给 `getLoadContext` 的 context 类型与项目的 `Env` 类型存在结构差异，被迫使用 `any`。

**修复：** 检查 `react-router-hono-server` 的类型定义，创建一个适配类型 `ServerContext = { var: { session: ...; request: ... } }`，让 `buildRouteContexts` 接受该类型而非 `any`。

---

### P3.4 Visitor Cookie 污染可缓存响应

**位置：** `src/server.ts`

`honoVisitorCookieMiddleware` 对 `/feed/*`、`/sitemap.xml`、 `/images/*` 都执行了，给这些可缓存资源附加了 `Set-Cookie`。这会破坏 CDN 缓存语义（`Cache-Control: public` + `Set-Cookie` 是矛盾组合）。

**修复：** 在 visitor cookie middleware 的 exempt 列表中加入 `/feed*`、`/sitemap.xml`、`/images/*`。

---

### P3.5 缺少 `204 No Content` 响应定义

多个 DELETE/POST 端点在成功时返回 `200: c.noBody()`，而语义上更适合 `204: c.noBody()`：

```ts
// admin/users.ts
softDeleteUser: {
  method: 'DELETE',
  responses: { 200: c.noBody(), ... },  // 应是 204
}
```

**修复：** 将无响应体的成功 DELETE/POST 改为 `204: c.noBody()`。

---

### P3.6 TanStack Query 缺少 SSR Hydration

**位置：** `src/client/api/query-client.ts`

```ts
// SSR dehydration is not implemented yet — the root loader still returns
// the initial data directly and client-side queries start from undefined
```

React Router loader 返回的数据与 TanStack Query 的缓存是割裂的。页面首次加载时，loader 已经获取了数据，但 `useApiQuery` 会再次发起请求（从 `undefined` 开始），造成双倍的网络 I/O 和 hydration mismatch 风险。

**修复：** 在 `root.tsx` 的 loader 中，将数据写入 QueryClient 的脱水状态，客户端通过 `<HydrationBoundary>` 恢复。

---

## 修复路线图

### 第一阶段（1-2 天）：止血

1. **P0.1**：在 `onErrorHandler` 中处理 `ActionFailure`（临时兼容）。
2. **P0.2**：在 `renderMath` / `renderMermaid` 中添加角色检查。
3. **P0.3**：修复 adapter 的 multipart 解析（将 FormData 直接透传）。
4. **P1.6**：SSE 端点改为 `setTimeout` 递归 + 竞态保护 + 异常日志。

### 第二阶段（3-5 天）：类型硬化

5. **P0.4**：移除 `app.ts` 中所有 `as any`，让 `mountContract` 的泛型约束生效。
6. **P1.1**：为一个代表性的 admin controller（如 `admin/settings.controller.ts`）添加 `satisfies ContractImpl<...>` 并替换 `args: any` 为精确类型，作为模板。
7. **P1.2**：优先替换高频端点的 `z.any()`（如 `admin/users.ts` 的 `list`、`get`，`comment.ts` 的 `loadComments`）。
8. **P1.3**：删除所有 admin controller 的手动鉴权代码，统一信任 Guard middleware。

### 第三阶段（5-7 天）：清理与一致性

9. **P1.5**：将 `onErrorHandler` 提升到根 app。
10. **P1.7**：移除 `apiContract` 的 `pathPrefix: '/api'`，用 Hono 的 `basePath` 处理前缀。
11. **P2.2**：修复 `getUser` 的 REST 语义（POST→GET，body→pathParams）。
12. **P2.3**：将 4 处 raw `fetch()` 替换为 `unwrap(api.xxx(...))`。
13. **P2.4**：建立查询键工厂。
14. **P2.7**：替换 `z.stringbool()` 为标准 Zod。

### 第四阶段（持续）：精细优化

15. **P2.1**：统一 Controller 错误风格为显式 `{ status, body }`。
16. **P3.1-P3.5**：命名统一、comment 端点合并、204 响应、visitor cookie 豁免。
17. **P3.6**：实现 TanStack Query SSR hydration。

---

## 附：核心文件质量评分

| 文件 | 职责 | 评分 | 主要扣分项 |
|---|---|---|---|
| `ts-rest-adapter.ts` | 契约→Hono 适配 | C+ | multipart 损坏、any cast、缺少方法支持 |
| `guards.ts` | RBAC 工厂 | B+ | 重复 session 读取 |
| `app.ts` | 应用装配 | D | 全部 `as any`、SSE 背压问题 |
| `errors.ts` | 全局错误处理 | C | 忽略 ActionFailure、日志缺失 |
| `openapi.ts` | OpenAPI 生成 | B | 路径前缀不匹配 |
| `admin/*.controller.ts` | Admin 控制器 | D | 0% 类型覆盖、60+ 处复制粘贴 |
| `comment.controller.ts` | 评论控制器 | C | 3 种错误风格混用、3 处 any cast |
| `account.controller.ts` | 账户控制器 | B+ | 无 ContractImpl 标注（但内联类型精确） |
| `client.ts` | ts-rest 客户端 | A | 干净 |
| `unwrap.ts` | 响应解包 | C | any cast、硬编码错误 shape |
| `query.ts` | TanStack 包装 | B | 无查询键工厂 |
| `shared/contracts/admin/*.ts` | Admin 契约 | D | 100% z.any()、错误码误用 |
| `shared/contracts/comment.ts` | 评论契约 | B | 10 处 z.any() |
| `shared/contracts/analytics.ts` | 分析契约 | A | 精确 |
| `server.ts` | 服务入口 | B | `c as any`、资源路由无 error handler |

---

*本审计报告旨在提供客观、可量化的质量评估。每个 P 级问题都附带了具体的文件路径、代码模式和修复方向，可直接转化为 GitHub Issue 或 PR 任务清单。*
