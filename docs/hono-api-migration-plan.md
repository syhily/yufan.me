# 计划：以 Hono 为外壳，统一所有非页面请求

本文档制定一份将 React Router Framework Mode 嵌入 Hono 外壳、并以 Hono 为
唯一权威重组所有 API / 资源路由 / 中间件的迁移计划。目标是让 React Router
回到"页面 SSR + 视图路由"的角色，所有非页面请求由 Hono 接管，API 契约通过
Hono RPC 的端到端类型推断单点定义。

---

## Part 0 — 范围与设计原则

### 0.1 "非页面请求" 的边界定义

| 类别 | 当前位置 | 迁移目标 | 数量 |
|---|---|---|---|
| API actions（JSON RPC） | `routes/api/actions/*.ts` | **Hono router** | 92 |
| RSS / Atom feeds | `routes/feed.*.ts` | **Hono router** | 6 |
| sitemap.xml | `routes/sitemap.ts` | **Hono router** | 1 |
| OG image | `routes/image.og.ts` | **Hono router** | 1 |
| calendar / dark calendar | `routes/image.calendar*.ts` | **Hono router** | 2 |
| avatar | `routes/image.avatar.ts` | **Hono router** | 1 |
| tags.index | `routes/tags.index.ts` | **Hono router** | 1 |
| search.index | `routes/search.index.ts` | **Hono router** | 1 |
| WordPress decoy probes（404 拦截） | RR middleware | **Hono middleware** | — |
| install-gate | RR middleware | **Hono middleware** | — |
| session / CSRF / client-address | RR middleware | **Hono middleware** | — |

**不动**（留在 RR）：

- 所有 `*.tsx` 页面（包含其 `loader` / `action` / `meta` / 默认组件）
- `wp-login.tsx` 的 `action`（form-encoded 登录，依赖 RR 渐进增强）
- `wp-admin.install.tsx` / `wp-admin.install.settings.tsx` 的 `action`（同上）
- `my.redirect.*.ts`（虽然是 .ts 但语义上是页面跳转，让 RR 处理更合适）

### 0.2 设计原则

1. **单一权威**：每个端点的 URL / method / 输入 schema / 输出类型 / 鉴权要求
   **在同一个 Hono 路由声明里完整定义**，无任何外置描述表（删 `API_ACTIONS`）。
2. **HTTP 语义保留**：GET 读、POST/PATCH/DELETE 写。这不是教条，是因为 87 个
   端点本来就分布在四种 method 上，不必为了换技术栈强行扁平化。
3. **类型端到端**：客户端通过 Hono RPC 的 `hc<AppType>` 直接拿到推断类型，
   不再有 `api-types.ts` 这种手抄层。
4. **Middleware 集中**：所有跨切面（session / CSRF / install-gate /
   rate-limit / RBAC）一次定义，对 API 和页面统一生效。
5. **服务层零改动**：`server/<domain>/service.ts` 业务逻辑不动。本次重构是
   **通信层**的重构，不是业务层。

---

## Part 1 — 目标架构

```
                            HTTP Request
                                 │
                                 ▼
                   ┌──────────────────────────┐
                   │         Hono app          │
                   │                          │
                   │  global middleware:      │
                   │   ─ clientAddress        │
                   │   ─ session              │
                   │   ─ install-gate         │
                   │   ─ wp-decoy             │
                   │   ─ csrf (mutations)     │
                   │                          │
                   │  route groups:           │
                   │   /api/* ─────────┐      │
                   │   /feed/* ────────┤      │
                   │   /sitemap.xml ───┤      │
                   │   /images/* ──────┤      │ → 类型化路由
                   │   /tags ──────────┤      │   ＋ Zod 校验
                   │   /search ────────┘      │
                   │                          │
                   │  catch-all:              │
                   │   * ──→ RR handler       │
                   │         (loadContext     │
                   │          from c.var.*)   │
                   └──────────────────────────┘
```

**RR 的角色**：仅处理"页面 SSR + 视图路由 + 页面级 form action"。它的
loader/action 通过 `loadContext` 读取 Hono middleware 已经填充好的
session/viewer。

---

## Part 2 — 文件结构

新增 / 调整：

```
src/
├── server/
│   ├── http/                            ← 新建：Hono 体系
│   │   ├── app.ts                       ← Hono app 装配（入口）
│   │   ├── context.ts                   ← Hono Variables 类型 + 注入辅助
│   │   ├── errors.ts                    ← HTTPException 映射，复用现有 DomainError
│   │   ├── validator.ts                 ← @hono/zod-validator 统一封装
│   │   ├── procedures.ts                ← publicRoute / authedRoute / adminRoute 工厂
│   │   └── routers/
│   │       ├── index.ts                 ← 聚合 + 导出 AppType
│   │       ├── account.ts               ← /api/account/*
│   │       ├── auth.ts                  ← /api/auth/*
│   │       ├── comment.ts               ← /api/comment/*
│   │       ├── image.ts                 ← /api/image/* （非生成图）
│   │       ├── music.ts                 ← /api/music/*
│   │       ├── analytics.ts             ← /api/analytics/*
│   │       ├── admin/
│   │       │   ├── index.ts             ← 聚合 + 注入 adminRoute
│   │       │   ├── users.ts
│   │       │   ├── comments.ts
│   │       │   ├── settings.ts
│   │       │   ├── cache.ts
│   │       │   ├── friends.ts
│   │       │   ├── categories.ts
│   │       │   ├── tags.ts
│   │       │   ├── images.ts
│   │       │   ├── music.ts
│   │       │   ├── pages.ts
│   │       │   ├── posts.ts
│   │       │   └── moderation.ts
│   │       ├── feed.ts                  ← /feed, /cats/:slug/feed, /tags/:slug/feed
│   │       ├── sitemap.ts               ← /sitemap.xml
│   │       ├── images.ts                ← /images/og/* /images/calendar/* /images/avatar/*
│   │       ├── tags.ts                  ← /tags（资源路由形态）
│   │       └── search.ts                ← /search（资源路由形态）
│   │
│   ├── middleware/                       ← 改造：从 RR middleware 改为 Hono middleware
│   │   ├── session.ts
│   │   ├── install-gate.ts
│   │   ├── wp-decoy.ts
│   │   ├── client-address.ts
│   │   ├── csrf.ts                       ← 抽取出来作为 mutation 中间件
│   │   └── visitor-cookie.ts             ← 已存在，保留
│   │
│   └── (其他 server/* 不变)
│
├── client/
│   ├── api/
│   │   ├── client.ts                     ← hc<AppType>('/') Hono Client 单例
│   │   ├── query.ts                      ← TanStack Query + Hono Client 包装
│   │   └── (废弃旧的 fetcher.ts / submit.ts)
│   └── ...
│
├── shared/
│   ├── api/                              ← 新建：客户端 + 服务端共用 schema
│   │   ├── account.ts                    ← Zod schemas
│   │   ├── comment.ts
│   │   ├── admin/...
│   │   └── ...
│   └── (废弃 api-actions.ts / api-types.ts / api-envelope.ts)
│
├── entry/
│   ├── server.node.ts                    ← 新建：Hono server entry（生产 + dev）
│   └── server.dev.ts                     ← 新建：Vite dev middleware 适配（可选）
│
└── routes.ts                              ← 简化：删除 API_ACTION_LIST 段
```

**消失的文件**：

```
src/shared/api-actions.ts
src/shared/api-types.ts
src/shared/api-envelope.ts
src/server/route-helpers/api-handler.ts
src/client/api/fetcher.ts
src/client/api/submit.ts
src/routes/api/actions/**     （92 个文件）
src/routes/feed.atom.ts
src/routes/feed.rss.ts
src/routes/sitemap.ts
src/routes/image.og.ts
src/routes/image.calendar.ts
src/routes/image.calendar.dark.ts
src/routes/image.avatar.ts
src/routes/tags.index.ts
src/routes/search.index.ts
```

**净代码量预估**：删 ~120 个文件 / ~5000 行；新增 ~30 个文件 / ~3500 行。
**净减 ~1500 行**。

---

## Part 3 — API 契约设计

### 3.1 路由工厂（`server/http/procedures.ts`）

类比当前 `defineApiAction` / `defineGuardedApiAction` 的语义，但实现为
Hono middleware 链：

```ts
// server/http/procedures.ts
import { Hono } from 'hono'
import type { Env } from '@/server/http/context'

export const publicRoute = () => new Hono<Env>()

export const authedRoute = () =>
  new Hono<Env>().use('*', async (c, next) => {
    const user = c.var.session.get('user')
    if (!user) throw new HTTPException(401, { message: '未登录' })
    c.set('viewer', { userId: user.id, role: user.role })
    await next()
  })

export const adminRoute = () =>
  new Hono<Env>().use('*', async (c, next) => {
    const user = c.var.session.get('user')
    requireUserRole(user, 'admin')   // 复用现有
    c.set('viewer', { userId: user.id, role: user.role })
    await next()
  })
```

### 3.2 单个 router 的写法（以 `admin/users.ts` 为例）

```ts
import { zValidator } from '@hono/zod-validator'

import { listUsersSchema, userIdSchema, muteUserSchema } from '@/shared/api/admin/users'
import { listUsersForAdmin, muteUser, softDeleteUser } from '@/server/users/service'
import { adminRoute } from '@/server/http/procedures'

export const adminUsersRouter = adminRoute()
  .get('/', zValidator('query', listUsersSchema), async (c) => {
    const payload = c.req.valid('query')
    const data = await listUsersForAdmin(payload, c.var.viewer)
    return c.json(data)
  })
  .get('/:id', async (c) => {
    const data = await getUserForAdmin(c.req.param('id'), c.var.viewer)
    return c.json(data)
  })
  .patch('/:id/mute', zValidator('json', muteUserSchema), async (c) => {
    const payload = c.req.valid('json')
    const data = await muteUser({ ...payload, userId: c.req.param('id') }, c.var.viewer)
    return c.json(data)
  })
  .delete('/:id', async (c) => {
    await softDeleteUser(c.req.param('id'), c.var.viewer)
    return c.body(null, 204)
  })
```

注意几点：

- **URL 形态变化**：`/api/actions/admin/listUsers` → `/api/admin/users`（GET）；
  `/api/actions/admin/muteUser` → `/api/admin/users/:id/mute`（PATCH）。**这是
  有意的 RESTful 改造**，让 URL 携带资源信息，更可读。
- **`run` perimeter 消失**：错误处理由 Hono 的 `onError` 集中接管，
  `HTTPException` / `DomainError` 都映射到 JSON 信封。
- **`viewer` 由 procedure middleware 注入**，handler 直接 `c.var.viewer`，
  零样板。
- **schema 在 `shared/api/`**，客户端的 form 校验、服务端的 validator 共用一份。

### 3.3 错误信封统一

```ts
// server/http/errors.ts
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message, issues: err.cause } }, err.status)
  }
  if (err instanceof DomainError) {
    return c.json({ error: { message: err.message } }, domainStatus(err))
  }
  log.error('unexpected', err)
  return c.json({ error: { message: '服务器内部错误' } }, 500)
})
```

**保留 `{ error: { message, issues? } }` 信封形态**——这是客户端目前的约定，
迁移期 37 个调用点的错误处理代码可以零改动。成功响应直接 `c.json(data)`，
**去掉 `{ data }` 外层包装**（这是当前最让人困惑的地方之一）。

### 3.4 聚合 + AppType 导出

```ts
// server/http/routers/index.ts
import { Hono } from 'hono'

import { accountRouter } from './account'
import { authRouter } from './auth'
import { commentRouter } from './comment'
import { adminRouter } from './admin'
// ...

export const apiRouter = new Hono<Env>()
  .route('/account', accountRouter)
  .route('/auth', authRouter)
  .route('/comment', commentRouter)
  .route('/admin', adminRouter)
  .route('/image', imageRouter)
  .route('/music', musicRouter)
  .route('/analytics', analyticsRouter)

export type ApiType = typeof apiRouter
```

### 3.5 是否同时上 tRPC？

**不上**。理由：

- Hono RPC 的 `hc<ApiType>` 已经提供端到端类型推断
- 你现在 87 个端点都是"按域 / 按动作"分布的 REST-shape，Hono router 自然映射
- tRPC 会再加一层抽象（procedure → router → app router），收益边际递减
- 客户端的 React Query 集成自己写 wrapper 即可（见 Part 6）

如果两年后发现需要 batching / subscription / 更深的类型推断，再在 Hono
上面挂 `@trpc/server` 的 Hono adapter——**架构不阻断这个升级**。

---

## Part 4 — Middleware 系统重组

### 4.1 Context 类型（`server/http/context.ts`）

```ts
import type { BlogSession } from '@/server/session'
import type { ViewerContext } from '@/server/auth/rbac'

export type Env = {
  Variables: {
    session: BlogSession
    sessionCookie: string | null
    clientAddress: string
    viewer: ViewerContext   // 仅在 authedRoute/adminRoute 之下保证非空
    requestId: string
  }
}
```

### 4.2 每个 middleware 一份职责

| Middleware | 现状位置 | 迁移后 | 主要改动 |
|---|---|---|---|
| `clientAddress` | `@/shared/request` + 调用点 | Hono `app.use('*', ...)` | 一次解析，全局 `c.var.clientAddress` |
| `session` | RR `createSessionStorage` + middleware | Hono middleware 读 cookie 起 session，结束时统一 `Set-Cookie` | session storage 实现保留（cookie + Redis），perimeter 改为 Hono |
| `installGate` | RR middleware | Hono middleware | 几乎 1:1 移植 |
| `wpDecoy` | RR middleware | Hono middleware **+** 应用顺序提到 install-gate 之前 | 让伪 WordPress 探针不触发安装检查 |
| `csrf` | `validateRequestCsrf` inline | Hono middleware（仅装在 mutation 路由组上） | 抽出来，写在 procedure 工厂里 |
| `rateLimit` | service 内调 `tryCommentPostRateLimit` 等 | Hono middleware（按路由配置） | 把"哪些路由限流"声明化 |

### 4.3 session 的真正迁移点

```ts
// server/middleware/session.ts
import { createMiddleware } from 'hono/factory'
import { sessionStorage } from '@/server/session/storage'  // 现有 Redis-backed

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const cookie = c.req.header('cookie') ?? ''
  const session = await sessionStorage.getSession(cookie)
  c.set('session', session)
  await next()
  if (c.var.sessionDirty) {
    c.header('Set-Cookie', await sessionStorage.commitSession(session))
  }
})
```

`createSessionStorage` 原语**保留**，只是它的调用方从 RR middleware 变成
Hono middleware。`tests/contract.cookie.test.ts` 锁定的文件路径要更新但
合同语义不变。

---

## Part 5 — 资源路由迁移

### 5.1 Feed routers

```ts
// server/http/routers/feed.ts
export const feedRouter = new Hono<Env>()
  .get('/feed', async (c) => renderRssFeed(c.var.viewer))                  // 替代 routes/feed.rss.ts
  .get('/feed/atom', async (c) => renderAtomFeed(c.var.viewer))            // 替代 routes/feed.atom.ts
  .get('/cats/:slug/feed', async (c) => renderRssFeed(c.var.viewer, { category: c.req.param('slug') }))
  .get('/cats/:slug/feed/atom', async (c) => renderAtomFeed(c.var.viewer, { category: c.req.param('slug') }))
  .get('/tags/:slug/feed', async (c) => renderRssFeed(c.var.viewer, { tag: c.req.param('slug') }))
  .get('/tags/:slug/feed/atom', async (c) => renderAtomFeed(c.var.viewer, { tag: c.req.param('slug') }))
```

URL 形态**完全保留**，外部 RSS 订阅者无感知。

### 5.2 Sitemap / OG / Calendar / Avatar

各自一个简单 GET，调现有 `server/sitemap`、`server/images/og`、
`server/images/calendar`、`server/images/avatar` 服务。**复用 100% 现有
渲染逻辑，仅 perimeter 换皮**。

### 5.3 `tags`、`search` 资源路由

这两个目前是"裸 .ts 资源路由"返回 JSON 给客户端搜索 widget。直接当 API
endpoint 处理：

- `/tags` → `searchRouter.get('/tags')`
- `/search` → `searchRouter.get('/search')`

挂载位置变化但 URL 保留。

---

## Part 6 — 客户端调用层

### 6.1 Hono Client + TanStack Query

```ts
// client/api/client.ts
import { hc } from 'hono/client'
import type { ApiType } from '@/server/http/routers'
//                          ^ 仅 type import — 不污染客户端 bundle

export const api = hc<ApiType>('/api')
```

```ts
// client/api/query.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// 通用查询：调 Hono client 的某个路径，自动解信封
export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<Response>,
  options?: UseQueryOptions<T>,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetcher()
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(body?.error?.message ?? res.statusText, res.status)
      }
      return res.json() as Promise<T>
    },
    ...options,
  })
}
```

### 6.2 调用点对比

```ts
// 现在：
const { data } = useApiFetcher<ListUsersInput, ListUsersOutput>(API_ACTIONS.admin.listUsers)
useEffect(() => { data?.load({ offset, limit }) }, [offset, limit])
const users = data?.users  // fetcher.data?.data?.users 这一层

// 之后：
const { data } = useApiQuery(
  ['admin', 'users', { offset, limit }],
  () => api.admin.users.$get({ query: { offset: String(offset), limit: String(limit) } }),
)
const users = data?.users  // 一层
```

**`api.admin.users.$get` 的参数类型由 Hono 路由自动推导**——schema 改了
客户端立即编译错。

### 6.3 mutation + 自动失效

```ts
function useMuteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MuteUserInput) =>
      api.admin.users[':id'].mute.$patch({ param: { id: input.userId }, json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}
```

代替现在的 `submit + revalidator.revalidate()`。

---

## Part 7 — 开发与构建链调整

### 7.1 依赖

```bash
vp add hono @hono/zod-validator @hono/node-server
vp add @tanstack/react-query
vp add -D @hono/vite-dev-server react-router-hono-server
```

### 7.2 Server entry

```ts
// src/entry/server.node.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createRequestHandler } from 'react-router'

import { clientAddress } from '@/server/middleware/client-address'
import { sessionMiddleware } from '@/server/middleware/session'
import { wpDecoyMiddleware } from '@/server/middleware/wp-decoy'
import { installGateMiddleware } from '@/server/middleware/install-gate'
import { apiRouter } from '@/server/http/routers'
import { feedRouter } from '@/server/http/routers/feed'
// ... 其他 resource routers

const app = new Hono<Env>()

app.use('*', clientAddress)
app.use('*', sessionMiddleware)
app.use('*', wpDecoyMiddleware)
app.use('*', installGateMiddleware)

app.route('/api', apiRouter)
app.route('/', feedRouter)
app.route('/', imageRouter)
app.route('/', sitemapRouter)
app.route('/', tagsSearchRouter)

// 兜底交给 RR
app.all('*', async (c) => {
  const handler = createRequestHandler(
    await import('virtual:react-router/server-build'),
    process.env.NODE_ENV,
  )
  return handler(c.req.raw, {
    session: c.var.session,
    viewer: c.var.session.get('user')
      ? { userId: c.var.session.get('user')!.id, role: c.var.session.get('user')!.role }
      : null,
    clientAddress: c.var.clientAddress,
  })
})

if (process.env.NODE_ENV === 'production') {
  serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 })
}

export default app
```

### 7.3 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import { reactRouterHonoServer } from 'react-router-hono-server/dev'

export default defineConfig({
  plugins: [
    reactRouterHonoServer({ runtime: 'node', entryFile: 'entry/server.node.ts' }),
    reactRouter(),
    // 其他既有插件
  ],
})
```

### 7.4 `react-router.d.ts`

```ts
declare module 'react-router' {
  interface AppLoadContext {
    session: BlogSession
    viewer: ViewerContext | null
    clientAddress: string
  }
}
```

### 7.5 Dockerfile

```diff
- CMD ["node", "build/server/index.js"]
+ CMD ["node", "build/server/entry.server.node.js"]
```

（确切路径取决于 `react-router-hono-server` 的输出约定，spike 时确认）

### 7.6 `routes.ts` 简化

```ts
export default [
  layout('routes/public.layout.tsx', [
    index('routes/home.tsx'),
    // ... 所有页面路由保留
  ]),
  // 删除：API_ACTION_LIST.map(...)
  // 删除：feed/sitemap/image 资源路由
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
    route('wp-admin/install/settings.php', 'routes/wp-admin.install.settings.tsx'),
  ]),
  layout('routes/wp-admin.layout.tsx', [
    // 所有 admin 页面路由保留
  ]),
] satisfies RouteConfig
```

清单从 ~150 行降到 ~70 行。

---

## Part 8 — 迁移路径（PR 拆分）

总工期估算：**8 周**。每周 2-3 个 PR。

### Phase A — 基建（Week 1-2，5 个 PR）

| PR | 内容 | 风险 |
|---|---|---|
| A1 | 安装依赖；建空的 `server/http/` 骨架；建 `entry/server.node.ts`；调整 `vite.config.ts` + `Dockerfile`；**仍把所有请求交给 RR**，仅验证 Hono 外壳 dev/build/部署不破坏现有功能 | 中（dev server 整合可能踩坑，spike） |
| A2 | session middleware 从 RR 迁到 Hono；RR loader 改为从 `context` 读 session | 中（session 是核心，回归测试） |
| A3 | clientAddress / install-gate / wp-decoy 迁 Hono middleware | 低 |
| A4 | 建 `shared/api/` 目录骨架，**先迁 1 个域的 schema**（建议 `account`，量小） | 低 |
| A5 | 建 `server/http/procedures.ts`、`errors.ts`、`validator.ts`；建 `routers/index.ts` 空聚合 | 低 |

**Phase A 完成态**：Hono 已经在前面跑，middleware 体系迁移完，但 API 端点
仍全部走 RR resource route。**任何时刻都能停在可发布状态**。

### Phase B — API 端点按域迁移（Week 3-6，11 个 PR）

每个域 1 个 PR。包含：

1. `shared/api/<domain>/` schema 完成
2. `server/http/routers/<domain>.ts` 写完
3. 客户端调用点改为 `api.<domain>.x.$get/$post`
4. 删除 `routes/api/actions/<domain>.*.ts`
5. `routes.ts` 移除对应条目

| PR | 域 | 端点数 |
|---|---|---|
| B1 | `account` | 3 |
| B2 | `auth` | 1 |
| B3 | `comment`（公共部分） | 17 |
| B4 | `image` + `music` | 2 |
| B5 | `analytics` | 5 |
| B6 | `admin/users` + `admin/sessions` | 7 |
| B7 | `admin/comments` + `admin/moderation` | 8 |
| B8 | `admin/settings` + `admin/cache` + `admin/mail` | 5 |
| B9 | `admin/friends` + `admin/categories` + `admin/tags` | 9 |
| B10 | `admin/images` + `admin/music` | 9 |
| B11 | `admin/pages` + `admin/posts`（最大，含编辑器 saveDraft） | 26 |

**B11 最重要也最危险**——saveDraft / publishLatest 涉及编辑器自动保存的
复杂状态机，需要专项回归。

### Phase C — 资源路由迁移（Week 7，3 个 PR）

| PR | 内容 |
|---|---|
| C1 | feed RSS / Atom（6 路由）→ `feedRouter` |
| C2 | sitemap + tags + search → 各自 router |
| C3 | OG image + calendar + avatar → `imageRouter` |

### Phase D — 清理与文档（Week 8，3 个 PR）

| PR | 内容 |
|---|---|
| D1 | 删除 `shared/api-actions.ts` / `api-types.ts` / `api-envelope.ts` / `server/route-helpers/api-handler.ts` / `client/api/fetcher.ts` / `client/api/submit.ts`；`routes/api/` 整个目录消失 |
| D2 | 更新 `AGENTS.md`：Sessions/Middleware/API 三章重写；新增"Hono server perimeter"章节；删除"react-router-framework-mode"作为 API 设计参考 |
| D3 | 新增 `tests/contract.hono-routes.test.ts`：枚举 `ApiType`，断言每个路径都有匹配的 client method；旧 `tests/contract.cookie.test.ts` 更新锁定路径 |

---

## Part 9 — 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| `react-router-hono-server` 在 dev 模式 HMR 偶发问题 | 中 | 低 | A1 阶段做 spike；社区 issue 已有 workaround 收录 |
| Session middleware 从 RR 迁 Hono 后，`commitSession` 时机错位导致登录态丢失 | 中 | 高 | A2 阶段开专项测试；保留旧实现作为 fallback 一周 |
| 编辑器自动保存（B11）在迁移后状态机不一致 | 中 | 高 | B11 之前先把 `useApiFetcher` 改写为 `useApiQuery` 已经在其他域稳定运行；B11 安排一周观察期 |
| URL 形态从 `/api/actions/admin/listUsers` 改为 `/api/admin/users` 后，监控/日志的告警规则失效 | 高 | 低 | Phase A1 同时更新告警规则；保留旧 URL 30 天 301 重定向 |
| Hono RPC 客户端类型推断在某些场景退化为 `unknown` | 低 | 中 | 早期 PR（B1-B3）先验证关键场景：query string、嵌套 path param、union 返回值。如真有问题考虑 `@trpc` 作为 fallback |
| `<Form method="post">` 渐进增强的 4 个页面 action 在 Hono context bridge 下错位 | 低 | 高 | 这些保留为 RR action，不经 Hono `/api/*` 路由；只通过 `loadContext` 读 session |
| AGENTS.md / Skills 配置长期不一致导致 AI 提建议时引用旧约定 | 高 | 低 | D2 必须在 D1 之前合并；Skill 引用的合同测试在 D3 同步更新 |

---

## Part 10 — 验收标准

每个 Phase 退出时必须满足：

**Phase A 退出**：

- `vp dev` 通过 Hono entry 启动，所有现有 URL 仍可访问
- `vp build && docker build` 产物可部署，启动正常
- session 在 Hono middleware 注入，RR loader 通过 `context.session` 读取
- 现有测试套件零回归

**Phase B 退出**（每个 PR 都要满足）：

- 该域所有端点通过 Hono 路由提供服务
- 客户端调用点改用 `api.<domain>.x`，TypeScript 编译通过
- 旧 `routes/api/actions/<domain>.*.ts` 删除
- 该域的 unit/integration 测试全绿

**Phase C 退出**：

- 外部订阅者访问的 URL 全部保留（feed / sitemap / OG / calendar / avatar）
- 输出字节级对比与迁移前一致（用 fixture 测试）

**Phase D 退出**：

- `git grep "API_ACTIONS\|api-types\|api-envelope\|defineApiAction"` 命中 0
- `routes/api/` 目录不存在
- `routes.ts` 行数 < 80
- AGENTS.md 的 "src/server/" 章节列出 `server/http/` 作为 API perimeter
- 新增的 `tests/contract.hono-routes.test.ts` 在 CI 中运行

---

## 推荐立即动作

不需要立刻开 9 个 PR。**第一步只做一件事**：

**Phase A1 spike（3 天）**——验证 `react-router-hono-server` + Vite+ 在
你这个项目上是否顺畅。spike 通过才进入正式计划。

spike 的产出：

- 一个 PR 分支，Hono entry 接管 dev server，所有现有 URL 不变
- dev / build / Docker 三件套都验证过
- 一份决策文档：HMR 体感、构建产物大小、启动时间、踩到的坑

spike 通过 → 按本计划推进。
spike 失败 → 退回到 "tRPC 挂在 RR resource route" 方案，损失 3 天。
