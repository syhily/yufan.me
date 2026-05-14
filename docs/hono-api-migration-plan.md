# 计划：以 Hono + ts-rest 为基础重构所有非页面请求

本文档是一份完整的迁移与重构计划。目标是把当前散落在 `routes/api/actions/`
的 92 个 RPC 风格 endpoint、6 个 feed 资源路由、若干图像生成路由以及五个
中间件 perimeter 全部收编进一套**契约驱动 + Hono runtime + React Router
作为 SSR 引擎**的单服务架构。

> 本文档默认读者已读过项目根 `AGENTS.md`，理解 server / client / ui / shared
> 四层架构和 RR Framework Mode 的 loader/action 模型。

---

## Part 0 — 背景、需求与硬约束

### 0.1 起因

当前 API 层的痛点（取自实际代码审查）：

- `defineApiAction` 同名地狱：descriptor 工厂在 `shared/api-actions.ts`，
  handler 工厂在 `server/route-helpers/api-handler.ts`。读代码时心智成本高。
- 类型三处对账：`shared/api-actions.ts`（descriptor）+
  `shared/api-types.ts`（手抄 Input/Output interfaces）+
  `server/<domain>/schema.ts`（Zod）。改一个端点要改三处。
- 自造信封 `{ data } | { error }` 让客户端到处 `fetcher.data?.data?.foo`。
- 双通道：RR `<Form>` action 一套约定，JSON channel 一套，
  `InputSource: 'json' | 'search' | 'form' | 'auto'` 是为了弥合两者。
- RBAC 散点式：`defineGuardedApiAction({ requireRole: 'admin' })` 散落在 92 个
  文件里，没有"权限矩阵"这种顶层视图。
- 输出无运行时校验：手抄的 Output type 跟实际响应漂移时无任何信号。

### 0.2 五条需求（来自需求方）

1. REST API 接口定义清晰，不混乱。
2. shared 组件在前后端共享 schema 与类型。
3. 给人**常见 REST API 框架的既视感**（资源、动词、状态码、控制器、守卫）。
4. 接口权限管理是一等公民。
5. 长期可维护性与代码组织结构。

### 0.3 硬约束

- **单服务部署**。不接受拆出独立 API service。一个 Node 进程，一个 Docker
  镜像，一次发布。
- **React Router 作为 SSR 引擎不动**。页面、loader、action、`<Form>` 渐进增强
  都保留。
- **服务层 (`server/<domain>/service.ts`) 业务逻辑零改动**。本次重构是
  通信层重构，不是业务层重构。
- **Vite+ 工具链保留**（`vp dev`/`vp build`/`vp check`/`vp test` 仍然可用）。
- **外部可见的 URL 形态保留**（feed/sitemap/OG image/avatar/calendar
  这些外部订阅 / SEO 关键 URL 字节级保留）。内部 API URL（`/api/actions/*`）
  允许变化但走 30 天 301。

### 0.4 终局一句话

> **Hono 作为 HTTP perimeter + ts-rest 作为契约层 + React Router 作为
> SSR 引擎，三者在同一 Node 进程里协作。`shared/contracts/` 是前后端唯一的
> 共享真相；`server/http/controllers/` 是契约的实现；RBAC 通过
> `publicRoute / authedRoute / adminRoute` 工厂在契约挂载时声明。**

---

## Part 1 — 目标架构

### 1.1 总体架构图

```
                            HTTP Request
                                 │
                                 ▼
                  ┌────────────────────────────────┐
                  │            Hono app             │
                  │                                │
                  │  global middleware (顺序固定):    │
                  │   1. requestId                  │
                  │   2. clientAddress              │
                  │   3. wpDecoy                    │
                  │   4. session                    │
                  │   5. installGate                │
                  │   6. errorBoundary (onError)    │
                  │                                │
                  │  mounts:                       │
                  │   ─ /api/*   ts-rest contracts │
                  │              + RBAC guards      │
                  │   ─ /feed/*    资源 Hono router │
                  │   ─ /sitemap.xml 资源 router    │
                  │   ─ /images/*  资源 router      │
                  │   ─ /search,/tags 资源 router  │
                  │                                │
                  │  catch-all:                    │
                  │   *  ──→ createRequestHandler   │
                  │          (RR SSR engine)        │
                  │          loadContext from c.var │
                  └────────────────────────────────┘
```

### 1.2 各层职责

| 层 | 职责 | 实现 |
|---|---|---|
| **Hono** | HTTP perimeter, middleware composition, RR mounting | `entry/server.node.ts` + `server/middleware/*` |
| **ts-rest contracts** | 端点契约（method / path / Zod input / Zod output / status code） | `shared/contracts/**` |
| **ts-rest adapter** | 把契约编译挂到 Hono router 上 + 注入 RBAC middleware | `server/http/ts-rest-adapter.ts`（项目自有，约 80 行） |
| **Controllers** | 实现契约，编排 service 层 | `server/http/controllers/**` |
| **Services** | 业务逻辑，DB / Redis / 第三方调用 | `server/<domain>/service.ts`（**零改动**） |
| **Resource routers** | 输出非 JSON 的端点（feed/XML、image/PNG、sitemap） | `server/http/resources/*` |
| **React Router** | SSR、页面路由、layout、页面级 form action | `routes/**`（仅页面） |
| **Client SDK** | 从契约自动派生的类型化客户端 | `client/api/client.ts`（`initClient<typeof apiContract>`） |

### 1.3 为什么是 ts-rest 而不是 Hono RPC / tRPC

**ts-rest** 的核心是**契约即文档**：契约对象与 server runtime 解耦，可独立
import、独立审查、独立发布。这是其他 TypeScript-native 方案缺的关键能力。

| 维度 | Hono RPC | `@hono/zod-openapi` | ts-rest | tRPC |
|---|---|---|---|---|
| 契约可独立审查 | × | △ | ○ | × |
| 契约对象 first-class | × | △ | ○ | × |
| status code 是契约一部分 | × | ○ | ○ | × |
| 响应体强制 schema | × | △ | ○（strictStatusCodes） | × |
| 客户端调用形态 | RPC 风 | 同 Hono | **REST 风** | RPC 风 |
| 切换 server runtime | 重写 router | 重写 router | **契约不变** | 重写 procedures |
| OpenAPI 互通 | △ | ○ | ○ | × |
| "REST framework既视感" | ★★★ | ★★★★ | ★★★★★ | ★ |

**ts-rest 的契约文件 = 你这个项目缺失的"REST API 定义文档"**——打开
`shared/contracts/admin/users.ts` 能完整看到该域的 API surface，这是
当前 grep 92 个文件才能拼出的视图。

---

## Part 2 — 文件结构总览

### 2.1 新增

```
src/
├── shared/
│   └── contracts/                      ← 新增：契约层（前后端唯一真相）
│       ├── _base.ts                       initContract() 实例 + 通用 schema
│       ├── _errors.ts                     统一错误响应 schema
│       ├── _types.ts                      跨域共享 DTO（Viewer, Page, ...）
│       │
│       ├── account.ts                     /api/account/*
│       ├── auth.ts                        /api/auth/*
│       ├── comment.ts                     /api/comment/*
│       ├── image.ts                       /api/image/*   (非生成图)
│       ├── music.ts                       /api/music/*
│       ├── analytics.ts                   /api/analytics/*
│       │
│       ├── admin/
│       │   ├── users.ts
│       │   ├── sessions.ts
│       │   ├── comments.ts
│       │   ├── moderation.ts
│       │   ├── settings.ts
│       │   ├── cache.ts
│       │   ├── mail.ts
│       │   ├── friends.ts
│       │   ├── categories.ts
│       │   ├── tags.ts
│       │   ├── images.ts
│       │   ├── music.ts
│       │   ├── pages.ts
│       │   └── posts.ts
│       │
│       └── index.ts                       聚合：apiContract (整棵契约树)
│
├── server/
│   ├── http/                            ← 新增：Hono + ts-rest 适配
│   │   ├── context.ts                     Hono Variables / Env 类型
│   │   ├── errors.ts                      HTTPException / DomainError 映射
│   │   ├── ts-rest-adapter.ts             契约 → Hono 路由的适配器（核心，~80 行）
│   │   ├── guards.ts                      publicRoute / authedRoute / adminRoute 工厂
│   │   ├── csrf.ts                        CSRF middleware (mutation 路由专用)
│   │   ├── rate-limit.ts                  per-route 限流 middleware 工厂
│   │   │
│   │   ├── controllers/                   契约实现层
│   │   │   ├── account.controller.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── comment.controller.ts
│   │   │   ├── image.controller.ts
│   │   │   ├── music.controller.ts
│   │   │   ├── analytics.controller.ts
│   │   │   └── admin/
│   │   │       ├── users.controller.ts
│   │   │       ├── sessions.controller.ts
│   │   │       ├── comments.controller.ts
│   │   │       ├── moderation.controller.ts
│   │   │       ├── settings.controller.ts
│   │   │       ├── cache.controller.ts
│   │   │       ├── mail.controller.ts
│   │   │       ├── friends.controller.ts
│   │   │       ├── categories.controller.ts
│   │   │       ├── tags.controller.ts
│   │   │       ├── images.controller.ts
│   │   │       ├── music.controller.ts
│   │   │       ├── pages.controller.ts
│   │   │       └── posts.controller.ts
│   │   │
│   │   ├── resources/                     非 ts-rest 的资源路由（XML / 二进制）
│   │   │   ├── feed.ts
│   │   │   ├── sitemap.ts
│   │   │   ├── images.ts                  OG / avatar / calendar
│   │   │   ├── tags.ts
│   │   │   └── search.ts
│   │   │
│   │   └── openapi.ts                     @ts-rest/open-api 生成 spec
│   │
│   └── middleware/                       从 RR middleware 迁来；改 Hono 接口
│       ├── client-address.ts
│       ├── session.ts
│       ├── install-gate.ts
│       ├── wp-decoy.ts
│       └── visitor-cookie.ts
│
├── client/
│   └── api/
│       ├── client.ts                     initClient<typeof apiContract>(...)
│       ├── query.ts                      TanStack Query 包装
│       ├── unwrap.ts                     ts-rest 响应解包 helper
│       └── error.ts                      ApiError class
│
├── entry/
│   └── server.node.ts                    Hono entry（生产 + dev）
│
└── routes.ts                              简化：删除 API_ACTION_LIST 段与资源路由段
```

### 2.2 消失

```
src/shared/api-actions.ts
src/shared/api-envelope.ts
src/shared/api-types.ts
src/server/route-helpers/api-handler.ts
src/client/api/fetcher.ts
src/client/api/submit.ts
src/client/api/use-admin-mutation.ts
src/client/api/render-math-fetch.ts             ← 改走 ts-rest client
src/client/api/render-mermaid-fetch.ts           ← 改走 ts-rest client
src/client/api/music-loader.ts                   ← 改走 ts-rest client
src/routes/api/actions/**                       （92 个文件）
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

### 2.3 净代码量预估

- **删**：~120 文件 / ~5500 行（含手写信封、descriptor、入参/出参 interface
  重复定义）
- **新增**：~50 文件 / ~3800 行（契约 + controller + 适配器 + OpenAPI 出口）
- **净减**：~1700 行；**心智成本下降更明显**——单一端点定义从 4 处对账变 1 处。

---

## Part 3 — 契约层设计（shared/contracts/）

### 3.1 契约文件组织规则

每个 URL 一级前缀对应一个契约文件：

- `shared/contracts/account.ts` → `/api/account/*`
- `shared/contracts/admin/users.ts` → `/api/admin/users/*`
- `shared/contracts/admin/posts.ts` → `/api/admin/posts/*`

**规则**：

1. 每个契约文件只导出**一个 router 契约 + 该 router 用到的 schema**。
2. Schema 命名：`<resource><Action>Query` / `<resource><Action>Body` /
   `<resource><Action>Response`（如 `listUsersQuery`、`muteUserBody`、
   `listUsersResponse`）。
3. 契约对象命名：`<domain>Contract`（如 `adminUsersContract`）。
4. Path prefix：在**聚合层**（`index.ts`）通过 `pathPrefix: '/api'` 一次设置，
   单文件契约里只写**该 router 自己的相对路径**（如 `/admin/users` 或
   `/admin/users/:id/mute`）。

### 3.2 `_base.ts` — 项目唯一的 contract instance

```ts
// src/shared/contracts/_base.ts
import { initContract } from '@ts-rest/core'

export const c = initContract()
```

所有契约文件都 `import { c } from '../_base'`。

### 3.3 `_errors.ts` — 统一错误响应

```ts
// src/shared/contracts/_errors.ts
import { z } from 'zod'

export const errorResponse = z.object({
  error: z.object({
    message: z.string(),
    issues: z
      .array(z.object({ message: z.string(), path: z.array(z.string()).optional() }))
      .optional(),
  }),
})

// 标准错误状态码集合，所有 mutation 契约 spread 进 responses 字段
export const standardMutationErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  413: errorResponse,
  429: errorResponse,
  500: errorResponse,
} as const

export const standardReadErrors = {
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  500: errorResponse,
} as const
```

**这是 ts-rest 比 Hono RPC 强出一截的地方**：错误也是契约的一部分。
客户端处理 4xx 时拿到的是 `{ error: { message, issues? } }`，IDE 自动补全。

### 3.4 单个契约文件模板

以 `admin/users.ts` 为例，展示所有常见模式：

```ts
// src/shared/contracts/admin/users.ts
import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'
import { adminUserDto, viewerContext } from '../_types'

// ─── Schemas ────────────────────────────────────────────

export const listUsersQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  role: z.enum(['all', 'admin', 'normal']).default('all'),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['recent', 'commentCount']).default('recent'),
  hasPosts: z.coerce.boolean().optional(),
})

export const listUsersResponse = z.object({
  users: z.array(adminUserDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export const muteUserBody = z.object({
  muted: z.boolean(),
})

export const updateUserRoleBody = z.object({
  role: z.enum(['admin', 'author', 'visitor']).nullable(),
})

// ─── Contract ──────────────────────────────────────────

export const adminUsersContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/users',
      query: listUsersQuery,
      responses: {
        200: listUsersResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：用户列表（搜索、筛选、排序）',
    },

    get: {
      method: 'GET',
      path: '/admin/users/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: z.object({ user: adminUserDto }),
        ...standardReadErrors,
      },
      summary: '管理后台：单个用户详情',
    },

    mute: {
      method: 'PATCH',
      path: '/admin/users/:id/mute',
      pathParams: z.object({ id: z.string().min(1) }),
      body: muteUserBody,
      responses: {
        200: z.object({ user: adminUserDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：禁言 / 解除禁言',
    },

    updateRole: {
      method: 'PATCH',
      path: '/admin/users/:id/role',
      pathParams: z.object({ id: z.string().min(1) }),
      body: updateUserRoleBody,
      responses: {
        200: z.object({ user: adminUserDto }),
        ...standardMutationErrors,
      },
    },

    softDelete: {
      method: 'DELETE',
      path: '/admin/users/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        204: c.noBody(),
        ...standardMutationErrors,
      },
    },

    restore: {
      method: 'POST',
      path: '/admin/users/:id/restore',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ user: adminUserDto }),
        ...standardMutationErrors,
      },
    },

    revokeAllSessions: {
      method: 'POST',
      path: '/admin/users/:id/sessions/revoke-all',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ revoked: z.number().int().nonnegative() }),
        ...standardMutationErrors,
      },
    },
  },
  {
    strictStatusCodes: true,
    commonResponses: {
      500: errorResponse, // 任何 handler 都可能抛 500
    },
  },
)
```

**注意几点**：

- **strictStatusCodes: true** —— handler 返回的 status 必须在 `responses`
  中显式声明，否则 TS 编译错。这是真正的契约严格性。
- **`pathParams`、`query`、`body` 都是 Zod schemas** —— 服务端运行时校验 +
  客户端编译期类型推导。
- **`c.noBody()`** —— DELETE / 204 / 无请求体的标准 sentinel。
- **`summary`** —— 用于 OpenAPI 出口的端点描述（Part 8）。

### 3.5 聚合（`index.ts`）

```ts
// src/shared/contracts/index.ts
import { c } from './_base'

import { accountContract } from './account'
import { authContract } from './auth'
import { commentContract } from './comment'
import { imageContract } from './image'
import { musicContract } from './music'
import { analyticsContract } from './analytics'

import { adminUsersContract } from './admin/users'
import { adminSessionsContract } from './admin/sessions'
import { adminCommentsContract } from './admin/comments'
// ... 其余 admin

export const apiContract = c.router(
  {
    account: accountContract,
    auth: authContract,
    comment: commentContract,
    image: imageContract,
    music: musicContract,
    analytics: analyticsContract,
    admin: c.router({
      users: adminUsersContract,
      sessions: adminSessionsContract,
      comments: adminCommentsContract,
      // ... 其余
    }),
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
```

`apiContract` 是**整个项目唯一的 API 真相**。它是一棵纯类型 + Zod 的对象树，
**零运行时副作用**，前后端都能 import。

### 3.6 URL 重新设计原则

借这次重构清理 URL：

- `/api/actions/admin/listUsers` → `/api/admin/users` (GET)
- `/api/actions/admin/getUser` → `/api/admin/users/:id` (GET)
- `/api/actions/admin/muteUser` → `/api/admin/users/:id/mute` (PATCH)
- `/api/actions/admin/restoreUser` → `/api/admin/users/:id/restore` (POST)
- `/api/actions/admin/softDeleteUser` → `/api/admin/users/:id` (DELETE)
- `/api/actions/comment/increaseLike` → `/api/comment/likes` (POST)
- `/api/actions/comment/decreaseLike` → `/api/comment/likes` (DELETE)
- `/api/actions/comment/loadComments` → `/api/comment/comments` (GET)
- `/api/actions/admin/savePostDraft` → `/api/admin/posts/:id/drafts` (POST)
- `/api/actions/admin/publishPostLatest` → `/api/admin/posts/:id/publish` (POST)

**原则**：
1. 名词复数表示集合资源（`/users`、`/posts`）。
2. `:id` 表示单一资源。
3. 子资源用嵌套路径（`/posts/:id/drafts`、`/users/:id/sessions`）。
4. 状态切换用动词子路径（`/users/:id/mute`、`/posts/:id/publish`），避免
   "/users PATCH body { muted: true }" 这种不直观的方式。
5. method 真正承担语义：GET 幂等读、POST 创建或动作、PATCH 部分更新、
   DELETE 删除。

### 3.7 命名约定备忘

| 操作语义 | 契约 key | HTTP | Path 模板 |
|---|---|---|---|
| 列表（带搜索/筛选/分页） | `list` | GET | `/<resources>` |
| 单条详情 | `get` | GET | `/<resources>/:id` |
| 创建 | `create` | POST | `/<resources>` |
| 整体替换 | `replace` | PUT | `/<resources>/:id` |
| 部分更新 | `update` | PATCH | `/<resources>/:id` |
| 状态切换 | 动词 | PATCH | `/<resources>/:id/<verb>` |
| 软删除 | `softDelete` | DELETE | `/<resources>/:id` |
| 恢复 | `restore` | POST | `/<resources>/:id/restore` |
| 复合查询 | `search` | GET | `/<resources>/search` |

---

## Part 4 — Controller 层（server/http/）

### 4.1 ts-rest 适配器（核心 ~80 行）

ts-rest 没有官方 Hono adapter（截至 2026 年），所以项目要自有一个轻量胶水。
**这是不可避免但一次性的成本**。

```ts
// src/server/http/ts-rest-adapter.ts
import type { AppRoute, AppRouter } from '@ts-rest/core'
import { isAppRoute, parseJsonQueryObject } from '@ts-rest/core'
import type { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError, type ZodTypeAny } from 'zod'

import type { Env } from './context'

interface HandlerContext {
  request: Request
  session: Env['Variables']['session']
  viewer: Env['Variables']['viewer'] | null
  clientAddress: string
}

interface HandlerArgs<R extends AppRoute> {
  query: R['query'] extends ZodTypeAny ? R['query']['_output'] : undefined
  body: R['body'] extends ZodTypeAny ? R['body']['_output'] : undefined
  params: R['pathParams'] extends ZodTypeAny ? R['pathParams']['_output'] : never
  headers: R['headers'] extends ZodTypeAny ? R['headers']['_output'] : undefined
}

type HandlerReturn<R extends AppRoute> = {
  [K in keyof R['responses']]: { status: K; body: R['responses'][K]['_output'] }
}[keyof R['responses']]

export type ContractImpl<R extends AppRouter> = {
  [K in keyof R]: R[K] extends AppRoute
    ? (args: HandlerArgs<R[K]>, ctx: HandlerContext) => Promise<HandlerReturn<R[K]>>
    : R[K] extends AppRouter
      ? ContractImpl<R[K]>
      : never
}

export interface MountOptions {
  middleware?: MiddlewareHandler<Env>[]
}

export function mountContract<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: MountOptions = {},
): void {
  for (const key of Object.keys(contract)) {
    const node = contract[key]
    const handler = (impl as Record<string, unknown>)[key]

    if (isAppRoute(node)) {
      mountRoute(app, node, handler as Function, options)
    } else {
      mountContract(app, node as AppRouter, handler as ContractImpl<AppRouter>, options)
    }
  }
}

function mountRoute(
  app: Hono<Env>,
  route: AppRoute,
  handler: Function,
  options: MountOptions,
) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'put'
  const path = normalizePath(route.path)

  const middlewares = options.middleware ?? []

  ;(app as any)[method](path, ...middlewares, async (c: any) => {
    const params = route.pathParams ? validate(route.pathParams, c.req.param()) : undefined
    const query = route.query ? validate(route.query, parseQuery(c.req.query())) : undefined
    const body = route.body ? validate(route.body, await readBody(c.req.raw, route)) : undefined
    const headers = route.headers ? validate(route.headers, headerObj(c.req.raw.headers)) : undefined

    const ctx: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
    }

    const result = await handler({ params, query, body, headers }, ctx)
    return c.json(result.body, result.status)
  })
}

function validate(schema: ZodTypeAny, input: unknown) {
  try {
    return schema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: '输入数据无效',
        cause: err.issues.map((i) => ({ message: i.message, path: i.path.map(String) })),
      })
    }
    throw err
  }
}

async function readBody(req: Request, route: AppRoute): Promise<unknown> {
  if (route.method === 'GET' || route.method === 'DELETE') return undefined
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('application/json')) return req.json()
  if (ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    return Object.fromEntries(fd.entries())
  }
  return undefined
}

function parseQuery(q: Record<string, string>): unknown {
  // ts-rest 支持 JSON-encoded query for nested objects, but we keep flat for simplicity
  return q
}

function headerObj(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  h.forEach((v, k) => (obj[k] = v))
  return obj
}

function normalizePath(p: string): string {
  // ts-rest paths use ":param", Hono uses ":param" too — pass through
  return p.startsWith('/') ? p : `/${p}`
}
```

**这 80 行是整个 API 层的 perimeter**——错误处理统一从 `validate()` 抛
`HTTPException`，Hono `onError` 拦截后映射到契约的错误响应。

### 4.2 RBAC 工厂（`server/http/guards.ts`）

```ts
// src/server/http/guards.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { AppRouter } from '@ts-rest/core'
import type { Hono } from 'hono'

import { hasRole, type Role } from '@/server/auth/rbac'
import type { Env } from './context'
import { mountContract, type ContractImpl } from './ts-rest-adapter'

const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.var.session.get('user')
  if (!user) throw new HTTPException(401, { message: '未登录' })
  c.set('viewer', { userId: user.id, role: user.role })
  await next()
})

const requireRoleMw = (role: Role) =>
  createMiddleware<Env>(async (c, next) => {
    const user = c.var.session.get('user')
    if (!user) throw new HTTPException(401, { message: '未登录' })
    if (!hasRole(user, role)) throw new HTTPException(403, { message: '权限不足' })
    c.set('viewer', { userId: user.id, role: user.role })
    await next()
  })

// ─── Public route mount (无鉴权) ──────────────────────
export function publicRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
) {
  mountContract(app, contract, impl)
}

// ─── Authed route mount (任何登录用户) ────────────────
export function authedRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
) {
  mountContract(app, contract, impl, { middleware: [requireAuth] })
}

// ─── Role-gated route mount ──────────────────────────
export function roleRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  role: Role,
) {
  mountContract(app, contract, impl, { middleware: [requireRoleMw(role)] })
}

export const adminRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: ContractImpl<R>) =>
  roleRoute(app, contract, impl, 'admin')

export const authorRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: ContractImpl<R>) =>
  roleRoute(app, contract, impl, 'author')
```

**关键设计**：RBAC 在**契约挂载点**声明，不在 handler 内 inline。
权限矩阵一目了然：

```ts
// src/server/http/app.ts —— 权限矩阵从这一个文件就能读懂
publicRoute(app, accountContract, accountController)         // 错误：account 必须登录
authedRoute(app, accountContract, accountController)         // ✓
publicRoute(app, commentContract, commentController)         // ✓ 评论公开
adminRoute(app, adminUsersContract, adminUsersController)    // ✓
adminRoute(app, adminPostsContract, adminPostsController)    // ✓
authorRoute(app, adminPagesContract, adminPagesController)   // ✓ author 也能编辑页面
```

权限审计变成"读 `app.ts` 一个文件"，不再是 grep 92 个文件。

### 4.3 Controller 写法

```ts
// src/server/http/controllers/admin/users.controller.ts
import type { ContractImpl } from '@/server/http/ts-rest-adapter'
import { adminUsersContract } from '@/shared/contracts/admin/users'

import {
  getUserForAdmin,
  listUsersForAdmin,
  muteUser,
  restoreUser,
  revokeAllUserSessions,
  softDeleteUser,
  updateUserRole,
} from '@/server/users/service'

export const adminUsersController: ContractImpl<typeof adminUsersContract> = {
  list: async ({ query }, { viewer }) => ({
    status: 200,
    body: await listUsersForAdmin(query, viewer!),
  }),

  get: async ({ params }, { viewer }) => {
    const user = await getUserForAdmin(params.id, viewer!)
    if (!user) return { status: 404, body: { error: { message: '用户不存在' } } }
    return { status: 200, body: { user } }
  },

  mute: async ({ params, body }, { viewer }) => ({
    status: 200,
    body: { user: await muteUser(params.id, body.muted, viewer!) },
  }),

  updateRole: async ({ params, body }, { viewer }) => ({
    status: 200,
    body: { user: await updateUserRole(params.id, body.role, viewer!) },
  }),

  softDelete: async ({ params }, { viewer }) => {
    await softDeleteUser(params.id, viewer!)
    return { status: 204, body: undefined }
  },

  restore: async ({ params }, { viewer }) => ({
    status: 200,
    body: { user: await restoreUser(params.id, viewer!) },
  }),

  revokeAllSessions: async ({ params }, { viewer }) => ({
    status: 200,
    body: { revoked: await revokeAllUserSessions(params.id, viewer!) },
  }),
}
```

**注意**：

- `ContractImpl<typeof adminUsersContract>` 给整个 controller 对象**精确类型**：
  缺一个 key 编译错，错状态码编译错，错 body shape 编译错。
- 业务逻辑全部转交 `@/server/users/service`，**服务层零改动**。
- `viewer!` 的非空断言是合法的——`adminRoute` 工厂已经保证 `c.var.viewer`
  存在，TS 不能跨 middleware 追踪到这一点。如果觉得 `!` 难看，可以在
  adapter 里加一个 narrowing helper。

### 4.4 装配（`server/http/app.ts`）

```ts
// src/server/http/app.ts
import { Hono } from 'hono'

import { apiContract } from '@/shared/contracts'
import { accountController } from './controllers/account.controller'
import { authController } from './controllers/auth.controller'
import { commentController } from './controllers/comment.controller'
import { imageController } from './controllers/image.controller'
import { musicController } from './controllers/music.controller'
import { analyticsController } from './controllers/analytics.controller'
import { adminUsersController } from './controllers/admin/users.controller'
import { adminPostsController } from './controllers/admin/posts.controller'
// ... 其他

import { adminRoute, authedRoute, authorRoute, publicRoute } from './guards'
import { onErrorHandler } from './errors'
import type { Env } from './context'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  // 错误兜底
  app.onError(onErrorHandler)

  // 权限矩阵（这一段就是项目的"API security policy"）
  authedRoute(app, apiContract.account, accountController)
  publicRoute(app, apiContract.auth, authController)
  publicRoute(app, apiContract.comment, commentController)
  publicRoute(app, apiContract.image, imageController)
  publicRoute(app, apiContract.music, musicController)
  publicRoute(app, apiContract.analytics, analyticsController)

  // Admin 子树
  adminRoute(app, apiContract.admin.users, adminUsersController)
  adminRoute(app, apiContract.admin.sessions, adminSessionsController)
  adminRoute(app, apiContract.admin.comments, adminCommentsController)
  authorRoute(app, apiContract.admin.posts, adminPostsController)   // author 可访问
  authorRoute(app, apiContract.admin.pages, adminPagesController)
  // ... 其余 admin

  return app
}
```

---

## Part 5 — Middleware 系统

### 5.1 Env 与 Context 类型

```ts
// src/server/http/context.ts
import type { BlogSession } from '@/server/session'
import type { ViewerContext } from '@/server/auth/rbac'

export type Env = {
  Variables: {
    requestId: string
    clientAddress: string
    session: BlogSession
    sessionDirty: boolean        // 由 service 设置，session middleware 决定是否 commit
    viewer: ViewerContext | null
  }
}
```

### 5.2 中间件清单与迁移要点

| Middleware | 现状 | 迁移后 | 改动幅度 |
|---|---|---|---|
| `requestId` | 无 | `hono/request-id` | 新增 |
| `clientAddress` | inline `@/shared/request` 调用 | Hono middleware，全局注入 `c.var.clientAddress` | 抽出 |
| `wpDecoy` | RR middleware | Hono middleware；放在 session 之前 | 1:1 |
| `session` | RR `createSessionStorage` + RR middleware | Hono middleware；commit 时机改为 response 即将发出前 | session storage 实现保留 |
| `installGate` | RR middleware | Hono middleware；exempt 路径列表（`/api`、`/feed`、`/images`、`/sitemap.xml`、`/wp-admin/install*`、`/wp-login.php`、`__manifest`） | 1:1 |
| `csrf` | inline `validateRequestCsrf` | Hono middleware；仅装在 mutation 路由组上（通过 guards 工厂控制） | 抽出 |
| `rateLimit` | inline 在 service 里 | Hono middleware，按路由签名声明 | 抽出 |
| `errorBoundary` | inline 在 `runApi` 里 | Hono `app.onError` | 集中 |

### 5.3 Session 迁移（最关键）

session 是核心依赖，必须正确迁移。

```ts
// src/server/middleware/session.ts
import { createMiddleware } from 'hono/factory'
import { sessionStorage } from '@/server/session/storage'   // 现有

import type { Env } from '@/server/http/context'

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const cookie = c.req.header('cookie') ?? ''
  const session = await sessionStorage.getSession(cookie)
  c.set('session', session)
  c.set('sessionDirty', false)

  await next()

  // 任何 controller / service 改了 session 之后调
  // c.set('sessionDirty', true)，这里统一 Set-Cookie。
  if (c.var.sessionDirty) {
    const setCookie = await sessionStorage.commitSession(session)
    c.header('Set-Cookie', setCookie, { append: true })
  }
})
```

**关键设计点**：

- `commitSession` 时机集中到 middleware after-next 钩子。当前代码里
  controller 各自调 `commitSession` 然后挂 header 的散点模式被消除。
- `sessionDirty` 是显式 flag——任何 controller 设了 session 之后必须
  `c.set('sessionDirty', true)`。**通过 Zod 严格的类型可以加 lint** 保证。

### 5.4 CSRF middleware

```ts
// src/server/http/csrf.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { validateRequestCsrf, clearCsrfCookie } from '@/server/session'   // 现有
import type { Env } from './context'

export const csrfGuard = createMiddleware<Env>(async (c, next) => {
  // 仅 POST/PATCH/DELETE/PUT 检查
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next()

  const body = c.req.method === 'POST' && c.req.header('content-type')?.startsWith('application/json')
    ? await c.req.json().catch(() => ({}))
    : Object.fromEntries((await c.req.parseBody().catch(() => ({}))) as Record<string, string>)

  const token = (body as any)?.csrf as string | undefined
  const [ok] = await validateRequestCsrf(c.req.raw, token)
  if (!ok) {
    c.header('Set-Cookie', await clearCsrfCookie(), { append: true })
    throw new HTTPException(403, { message: '页面安全令牌已失效，请刷新后重试。' })
  }

  await next()
})
```

CSRF guard 装在**特定契约**上而非全局——例如评论提交、登录、安装：

```ts
publicRoute(app, apiContract.comment.replyComment, commentReplyController, {
  middleware: [csrfGuard],
})
```

> 实现层面 `publicRoute` 等工厂要接受额外 middleware 数组参数。Part 4.2 的
> 工厂签名需要相应扩展。

### 5.5 Rate-limit middleware

```ts
// src/server/http/rate-limit.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { tryRateLimit } from '@/server/rate-limit'   // 现有
import type { Env } from './context'

export const rateLimitByIp = (key: string, max: number, windowMs: number) =>
  createMiddleware<Env>(async (c, next) => {
    const { exceeded } = await tryRateLimit(`${key}:${c.var.clientAddress}`, max, windowMs)
    if (exceeded) throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' })
    await next()
  })
```

### 5.6 `onError` 统一映射

```ts
// src/server/http/errors.ts
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { DomainError, domainStatus } from '@/server/route-helpers/errors'   // 保留现有 vocabulary
import { getLogger } from '@/server/logger'
import type { Env } from './context'

const log = getLogger('http.error')

export function onErrorHandler(err: Error, c: Context<Env>): Response {
  if (err instanceof HTTPException) {
    const payload = {
      error: {
        message: err.message,
        issues: (err.cause as { message: string; path?: string[] }[] | undefined),
      },
    }
    return c.json(payload, err.status)
  }

  if (err instanceof DomainError) {
    return c.json({ error: { message: err.message } }, domainStatus(err))
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          message: '输入数据无效',
          issues: err.issues.map((i) => ({ message: i.message, path: i.path.map(String) })),
        },
      },
      400,
    )
  }

  const requestId = c.var.requestId
  log.error('unexpected', { requestId, error: err })
  c.header('X-Request-Id', requestId)
  return c.json({ error: { message: '服务器内部错误' } }, 500)
}
```

`DomainError` 与 `domainStatus` 复用现有代码（`server/route-helpers/errors.ts`），
保证错误语义连续——只是 perimeter 换了。

---

## Part 6 — 资源路由（非 ts-rest）

### 6.1 为什么这些不走 ts-rest

ts-rest 假设输出是 JSON 且有 Zod schema 校验。以下端点输出形态特殊：

- Feed RSS / Atom：`application/rss+xml` / `application/atom+xml`
- Sitemap：`application/xml`
- OG image / calendar / avatar：`image/png` 二进制流
- `tags` / `search`（如保留 JSON 形态）：可以走 ts-rest，但当前
  形态是 SSR 内部使用，**为了和其他资源路由摆在一起，也独立**

**放到 `server/http/resources/`，直接挂 Hono 原生 router**。

### 6.2 Feed router

```ts
// src/server/http/resources/feed.ts
import { Hono } from 'hono'

import { renderRssFeed, renderAtomFeed } from '@/server/feed/render'
import type { Env } from '../context'

export const feedRouter = new Hono<Env>()
  .get('/feed', async (c) => {
    const xml = await renderRssFeed()
    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    return c.body(xml)
  })
  .get('/feed/atom', async (c) => {
    const xml = await renderAtomFeed()
    c.header('Content-Type', 'application/atom+xml; charset=utf-8')
    return c.body(xml)
  })
  .get('/cats/:slug/feed', async (c) => {
    const xml = await renderRssFeed({ category: c.req.param('slug') })
    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    return c.body(xml)
  })
  .get('/cats/:slug/feed/atom', async (c) => {
    const xml = await renderAtomFeed({ category: c.req.param('slug') })
    c.header('Content-Type', 'application/atom+xml; charset=utf-8')
    return c.body(xml)
  })
  .get('/tags/:slug/feed', async (c) => {
    const xml = await renderRssFeed({ tag: c.req.param('slug') })
    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    return c.body(xml)
  })
  .get('/tags/:slug/feed/atom', async (c) => {
    const xml = await renderAtomFeed({ tag: c.req.param('slug') })
    c.header('Content-Type', 'application/atom+xml; charset=utf-8')
    return c.body(xml)
  })
```

URL 形态**完全保留**，外部 RSS 订阅者无感知。

### 6.3 Sitemap / Images

`server/http/resources/sitemap.ts`、`server/http/resources/images.ts`
类似——直接调现有 `@/server/sitemap`、`@/server/images/*` 服务，
**渲染逻辑零改动**，仅 perimeter 换皮。

### 6.4 `tags` / `search`

这两个目前返回 JSON 给客户端 search widget 使用。**可以纳入契约层**：

```ts
// src/shared/contracts/search.ts
export const searchContract = c.router({
  search: {
    method: 'GET',
    path: '/search',
    query: z.object({ q: z.string().trim().min(1).max(100) }),
    responses: { 200: searchResultsSchema },
  },
  listAllTags: {
    method: 'GET',
    path: '/tags',
    responses: { 200: z.object({ tags: z.array(tagDto) }) },
  },
}, { pathPrefix: '' })   // 这两个不在 /api 前缀下，保留旧 URL
```

**特殊点**：`pathPrefix: ''` 表示不走 `/api` 前缀。`tags` 和 `search`
作为顶级路径在主聚合里独立挂载，避免影响 `/api/*` 的命名空间。

---

## Part 7 — 客户端调用层

### 7.1 ts-rest client 单例

```ts
// src/client/api/client.ts
import { initClient } from '@ts-rest/core'

import { apiContract } from '@/shared/contracts'
//                          ^ 这里只有 type 是 zero-cost，runtime 部分会引入 schema
//                            但 schema 本来客户端就需要（form 校验），重复利用

export const api = initClient(apiContract, {
  baseUrl: '',                              // 同源，走相对路径
  baseHeaders: {
    'Content-Type': 'application/json',
  },
})
```

> **Bundle 注意**：`apiContract` 会把所有 Zod schema 拉进 client bundle。
> 总体大小估算 < 50KB gzipped（92 个端点、平均 3-5 行 Zod）。如果担心，
> 可以分两个 apiContract：`apiContractPublic`（公共契约，进 public bundle）
> 和 `apiContractAdmin`（admin 契约，仅 admin bundle 引入，通过路由 code
> split）。**首版不必拆**，先观察实际 bundle 体积。

### 7.2 响应解包 helper

```ts
// src/client/api/unwrap.ts
import { ApiError } from './error'

import type { ClientInferResponses } from '@ts-rest/core'

export async function unwrap<T extends { status: number; body: unknown }>(
  promise: Promise<T>,
): Promise<Extract<T, { status: 200 | 201 | 204 }>['body']> {
  const res = await promise
  if (res.status >= 200 && res.status < 300) {
    return (res as any).body
  }
  const body = res.body as { error?: { message?: string; issues?: unknown } } | undefined
  throw new ApiError(
    body?.error?.message ?? `HTTP ${res.status}`,
    res.status,
    body?.error?.issues,
  )
}
```

### 7.3 TanStack Query 包装

```ts
// src/client/api/query.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'

import { ApiError } from './error'

export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, ApiError>({ queryKey: key, queryFn: fetcher, ...options })
}

export function useApiMutation<TVars, TData>(
  mutate: (vars: TVars) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, ApiError, TVars>, 'mutationFn'>,
) {
  return useMutation<TData, ApiError, TVars>({ mutationFn: mutate, ...options })
}
```

### 7.4 调用点对比

**列表（GET）**：

```tsx
// 之前：
const { data, load } = useApiFetcher<ListUsersInput, ListUsersOutput>(
  API_ACTIONS.admin.listUsers,
)
useEffect(() => { load({ offset, limit }) }, [offset, limit])
const users = data?.users   // fetcher.data?.data?.users

// 之后：
import { api } from '@/client/api/client'
import { useApiQuery } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'

const { data } = useApiQuery(
  ['admin', 'users', { offset, limit }],
  () => unwrap(api.admin.users.list({ query: { offset, limit } })),
)
const users = data?.users
```

**Mutation + 失效**：

```tsx
const qc = useQueryClient()
const muteUser = useApiMutation(
  ({ id, muted }: { id: string; muted: boolean }) =>
    unwrap(api.admin.users.mute({ params: { id }, body: { muted } })),
  {
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  },
)
```

代替现在的"`submit` + 手动 `revalidator.revalidate()`"。

### 7.5 SSR loader 如何调 API

SSR 时 RR loader 仍然存在，但**不通过 HTTP 调 ts-rest**——直接调
service 层（同进程，零网络成本）：

```ts
// src/routes/wp-admin.users.tsx
import type { Route } from './+types/wp-admin.users'
import { listUsersForAdmin } from '@/server/users/service'

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const data = await listUsersForAdmin(
    {
      offset: Number(url.searchParams.get('offset')) || 0,
      limit: Number(url.searchParams.get('limit')) || 20,
      // ...
    },
    context.viewer!,
  )
  return data   // RR loader 自动序列化
}
```

**SSR loader 不走 HTTP 走 service，hydration 后客户端的 TanStack Query
seed 用 loader 数据，后续筛选 / 翻页才发起 HTTP**。这是和 Part 3 的
TanStack Query 协作约定的来源——既保留 SSR 首屏速度，又让客户端缓存
干净生效。

---

## Part 8 — OpenAPI 与开发工具

### 8.1 自动生成 OpenAPI spec

```ts
// src/server/http/openapi.ts
import { generateOpenApi } from '@ts-rest/open-api'

import { apiContract } from '@/shared/contracts'

export function buildOpenApiDocument() {
  return generateOpenApi(apiContract, {
    info: {
      title: 'Yufan.me API',
      version: '1.0.0',
      description: 'Internal API for the Yufan.me blog platform.',
    },
    servers: [{ url: '/', description: 'current origin' }],
  })
}
```

### 8.2 挂载 Swagger UI（仅 dev / 仅 admin）

```ts
// 在 createApiApp 里
import { swaggerUI } from '@hono/swagger-ui'

if (process.env.NODE_ENV !== 'production') {
  app.get('/openapi.json', (c) => c.json(buildOpenApiDocument()))
  app.get('/docs', swaggerUI({ url: '/openapi.json' }))
}
```

访问 `/docs` 看到完整可交互的 API 文档。这是 NestJS / Spring Boot 等
传统 REST framework 的标准能力，现在你也有了。

### 8.3 OpenAPI spec 同时让外部工具可用

- 给前端做 mock server：`prism mock openapi.json`
- 给 QA 做契约测试：Schemathesis / Dredd
- 给团队新成员看 API surface：`/docs` 一目了然

---

## Part 9 — 测试策略

### 9.1 契约测试（最重要的新增层）

```ts
// tests/contract.apiContract.test.ts
import { apiContract } from '@/shared/contracts'
import { createApiApp } from '@/server/http/app'
import { testClient } from 'hono/testing'

describe('apiContract', () => {
  const app = createApiApp()
  const client = testClient(app)

  it('每个契约 endpoint 都有对应路由挂载', () => {
    // 遍历 apiContract 树，收集所有 path+method
    const endpoints = collectEndpoints(apiContract)
    for (const ep of endpoints) {
      // 通过 OPTIONS / 实际 GET 验证路由存在
      // 或检查 app.routes（Hono 提供）
    }
  })

  it('strictStatusCodes 在 controller 类型层强制', () => {
    // TypeScript 编译期检查；这里只断言契约本身的 strictStatusCodes flag
    expect(apiContract.admin.users._def.strictStatusCodes).toBe(true)
  })
})
```

### 9.2 Controller 单测（直接调 controller 对象）

```ts
// tests/controller.admin-users.test.ts
import { adminUsersController } from '@/server/http/controllers/admin/users.controller'

describe('adminUsersController.list', () => {
  it('returns 200 with users + total', async () => {
    const result = await adminUsersController.list(
      { query: { offset: 0, limit: 20, role: 'all', sortBy: 'recent', includeDeleted: false } },
      { viewer: { userId: 'u1', role: 'admin' }, /* ... */ },
    )
    expect(result.status).toBe(200)
    expect(result.body.users).toBeInstanceOf(Array)
  })
})
```

**Controller 是普通对象，单测开销极小**。

### 9.3 E2E 测试（用 Hono `testClient`）

```ts
// tests/e2e.admin-users.test.ts
import { testClient } from 'hono/testing'
import { createApiApp } from '@/server/http/app'

describe('GET /api/admin/users', () => {
  const client = testClient(createApiApp())

  it('401 without session', async () => {
    const res = await client.api.admin.users.$get({ query: { offset: '0', limit: '20' } })
    expect(res.status).toBe(401)
  })

  it('200 with admin session', async () => {
    const res = await client.api.admin.users.$get(
      { query: { offset: '0', limit: '20' } },
      { headers: { cookie: await makeAdminCookie() } },
    )
    expect(res.status).toBe(200)
  })
})
```

> Hono `testClient` 在 ts-rest 适配后会带契约推导的类型，**端到端类型在测试
> 里也是活的**——这是契约层的额外红利。

### 9.4 类型测试（@ts-rest 推断没退化）

```ts
// tests/type.contract.test-d.ts
import { expectTypeOf } from 'vitest'
import type { ClientInferResponseBody } from '@ts-rest/core'
import { apiContract } from '@/shared/contracts'
import type { AdminUserDto } from '@/shared/contracts/_types'

type ListUsersBody = ClientInferResponseBody<typeof apiContract.admin.users.list, 200>

expectTypeOf<ListUsersBody>().toMatchTypeOf<{ users: AdminUserDto[]; total: number; hasMore: boolean }>()
```

任何一个端点的输入/输出类型漂移立刻在 CI 红线。这是手抄 `api-types.ts`
时代没有的能力。

---

## Part 10 — 开发与构建链

### 10.1 依赖增量

```bash
vp add hono @hono/zod-validator @hono/node-server @hono/request-id @hono/swagger-ui
vp add @ts-rest/core @ts-rest/open-api
vp add @tanstack/react-query
vp add -D @hono/vite-dev-server react-router-hono-server
```

### 10.2 Server entry

```ts
// src/entry/server.node.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { requestId } from 'hono/request-id'
import { createRequestHandler } from 'react-router'

import { createApiApp } from '@/server/http/app'
import { feedRouter } from '@/server/http/resources/feed'
import { sitemapRouter } from '@/server/http/resources/sitemap'
import { imagesRouter } from '@/server/http/resources/images'
import { tagsRouter } from '@/server/http/resources/tags'
import { searchRouter } from '@/server/http/resources/search'

import { clientAddressMiddleware } from '@/server/middleware/client-address'
import { sessionMiddleware } from '@/server/middleware/session'
import { wpDecoyMiddleware } from '@/server/middleware/wp-decoy'
import { installGateMiddleware } from '@/server/middleware/install-gate'
import { onErrorHandler } from '@/server/http/errors'

import type { Env } from '@/server/http/context'

const app = new Hono<Env>()

app.onError(onErrorHandler)

app.use('*', requestId())
app.use('*', clientAddressMiddleware)
app.use('*', wpDecoyMiddleware)
app.use('*', sessionMiddleware)
app.use('*', installGateMiddleware)

// ─── API (ts-rest contracts) ────────────────────────
app.route('/', createApiApp())

// ─── Resource routes (非 ts-rest) ──────────────────
app.route('/', feedRouter)
app.route('/', sitemapRouter)
app.route('/', imagesRouter)
app.route('/', tagsRouter)
app.route('/', searchRouter)

// ─── Catch-all → React Router SSR ───────────────────
app.all('*', async (c) => {
  const build = await import('virtual:react-router/server-build')
  const handler = createRequestHandler(build, process.env.NODE_ENV ?? 'production')
  const user = c.var.session.get('user')
  return handler(c.req.raw, {
    session: c.var.session,
    viewer: user ? { userId: user.id, role: user.role } : null,
    clientAddress: c.var.clientAddress,
  })
})

if (process.env.NODE_ENV === 'production') {
  serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 })
}

export default app
```

### 10.3 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import { reactRouterHonoServer } from 'react-router-hono-server/dev'

export default defineConfig({
  plugins: [
    reactRouterHonoServer({
      runtime: 'node',
      serverEntryPoint: 'src/entry/server.node.ts',
    }),
    reactRouter(),
    // 其他既有插件
  ],
})
```

### 10.4 `react-router.d.ts`

```ts
declare module 'react-router' {
  interface AppLoadContext {
    session: BlogSession
    viewer: ViewerContext | null
    clientAddress: string
  }
}
```

### 10.5 `routes.ts` 简化

```ts
import { layout, index, route } from '@react-router/dev/routes'

export default [
  layout('routes/public.layout.tsx', [
    index('routes/home.tsx'),
    route('page/:num', 'routes/home.tsx', { id: 'home-page' }),
    route('archives', 'routes/archives.tsx'),
    route('categories', 'routes/categories.tsx'),
    route('cats/:slug', 'routes/category.list.tsx'),
    route('cats/:slug/page/:num', 'routes/category.list.tsx', { id: 'category-list-page' }),
    route('tags/:slug', 'routes/tag.list.tsx'),
    route('tags/:slug/page/:num', 'routes/tag.list.tsx', { id: 'tag-list-page' }),
    route('search/:keyword', 'routes/search.list.tsx'),
    route('search/:keyword/page/:num', 'routes/search.list.tsx', { id: 'search-list-page' }),
    route('posts/:slug', 'routes/post.detail.tsx'),
    route(':slug', 'routes/page.detail.tsx'),
    route('*', 'routes/not-found.tsx'),
  ]),

  // 兼容跳转
  route('my/comments', 'routes/my.redirect.comments.ts'),
  route('my/profile', 'routes/my.redirect.profile.ts'),

  // 登录 / 安装（保留 RR action 用于渐进增强）
  layout('routes/admin.layout.tsx', [
    route('wp-login.php', 'routes/wp-login.tsx'),
    route('wp-admin/install.php', 'routes/wp-admin.install.tsx'),
    route('wp-admin/install/settings.php', 'routes/wp-admin.install.settings.tsx'),
  ]),

  // wp-admin SPA shell
  layout('routes/wp-admin.layout.tsx', [
    // ... 所有 admin 页面路由保留
  ]),
] satisfies RouteConfig
```

清单从 ~150 行降到 ~70 行——所有 API_ACTION_LIST 和资源路由段全部消失。

### 10.6 Dockerfile

```diff
- CMD ["node", "build/server/index.js"]
+ CMD ["node", "build/server/index.js"]   # path 由 react-router-hono-server 决定
```

具体输出路径取决于 `react-router-hono-server` 的 build 产物约定，
**Phase A1 spike 时确认**。

---

## Part 11 — 迁移路径（PR 拆分）

总工期估算：**约 10 周**（增加了契约编写工作量）。每周 2-3 个 PR。

### Phase A — 基建（Week 1-2，6 PR）

| PR | 内容 | 风险 |
|---|---|---|
| A1 | spike：安装 Hono + ts-rest 依赖；空 `server/http/` 骨架；建 `entry/server.node.ts`；调整 `vite.config.ts` + `Dockerfile`；**所有请求仍交给 RR**，仅验证外壳层不破坏现有功能 | 中（dev server 整合可能踩坑） |
| A2 | 实现 `ts-rest-adapter.ts` + `guards.ts` + `errors.ts`；写单测验证适配器 | 中（核心胶水，必须稳） |
| A3 | session middleware 从 RR 迁到 Hono；RR loader 改为从 `context` 读 session | 高（核心，专项回归） |
| A4 | clientAddress / install-gate / wp-decoy / requestId 迁 Hono middleware | 低 |
| A5 | 建 `shared/contracts/` 骨架：`_base.ts`、`_errors.ts`、`_types.ts`、`index.ts`（空聚合） | 低 |
| A6 | OpenAPI 出口 + Swagger UI（dev only）；在 `/docs` 验证 spec 生成正常 | 低 |

**Phase A 完成态**：Hono 已在前面跑，middleware 体系迁移完毕，
但 API 端点仍走 RR resource route。**可发布**。

### Phase B — API 端点按域迁移（Week 3-8，14 PR）

每个域 1 个 PR。每个 PR 完成：

1. 完成 `shared/contracts/<domain>.ts`（含 schema + 契约对象）
2. 完成 `server/http/controllers/<domain>.controller.ts`
3. 在 `server/http/app.ts` 添加 `*Route(...)` 挂载
4. 客户端调用点改用 `api.<domain>.x(...)`
5. 删除 `routes/api/actions/<domain>.*.ts`
6. `routes.ts` 移除对应条目
7. 设置 30 天 301 redirect 从旧 URL 到新 URL（仅生产环境）

| PR | 域 | 旧端点数 | 备注 |
|---|---|---|---|
| B1 | `account` | 3 | 小域，建立模板 |
| B2 | `auth` | 1 | 极小 |
| B3 | `analytics` | 5 | 简单 GET |
| B4 | `image` + `music` | 2 | 简单 |
| B5 | `comment`（公共部分，非 admin） | 15 | 含 CSRF guard |
| B6 | `admin/users` + `admin/sessions` | 7 | adminRoute 首次使用 |
| B7 | `admin/comments` + `admin/moderation` | 8 | 含审核工作流 |
| B8 | `admin/settings` + `admin/cache` + `admin/mail` | 5 | |
| B9 | `admin/friends` + `admin/categories` + `admin/tags` | 9 | |
| B10 | `admin/images` | 5 | 含 multipart upload 的边角处理 |
| B11 | `admin/music` | 4 | 含外部 API 查询 |
| B12 | `admin/posts`（不含编辑器自动保存） | 12 | |
| B13 | `admin/pages`（不含编辑器自动保存） | 12 | |
| B14 | 编辑器自动保存：`saveDraft` / `publishLatest` / `previewPage` / `previewPost` / `renderMath` / `renderMermaid`（跨 posts + pages） | 8 | **最危险**，单独 PR |

**B14 重点**：编辑器自动保存涉及复杂状态机（draft conflict / autosave
debounce / preview）。必须在所有其他域稳定运行 2 周后再做，并安排
1 周观察期。

### Phase C — 资源路由（Week 9，3 PR）

| PR | 内容 |
|---|---|
| C1 | `feedRouter`（替代 6 个 feed RR 资源路由） |
| C2 | `sitemapRouter` + `tagsRouter` + `searchRouter` |
| C3 | `imagesRouter`（OG / calendar / calendar.dark / avatar） |

每个 PR 后做**字节级对比测试**：迁移前后同一个 URL 的输出 byte-identical
（用 fixture 比较）。

### Phase D — 清理与文档（Week 10，4 PR）

| PR | 内容 |
|---|---|
| D1 | 删除 `shared/api-actions.ts` / `api-envelope.ts` / `api-types.ts` / `server/route-helpers/api-handler.ts` / `client/api/fetcher.ts` / `client/api/submit.ts` / `client/api/use-admin-mutation.ts`；`routes/api/` 整个目录消失 |
| D2 | 更新 `AGENTS.md`：重写 Architecture / Sessions / API 三章；新增"Hono server perimeter"和"ts-rest contracts"章节；从 `react-router-framework-mode` skill 引用列表中移除 API 部分 |
| D3 | 新增 `tests/contract.apiContract.test.ts`（Part 9.1）+ `tests/type.contract.test-d.ts`（Part 9.4）；更新 `tests/contract.cookie.test.ts` 锁定路径 |
| D4 | 关闭 301 redirect（30 天观察期后）；监控告警规则切到新 URL |

---

## Part 12 — 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| `react-router-hono-server` 在 dev 模式 HMR 偶发问题 | 中 | 低 | A1 spike 验证；社区 issue 中 workaround 已收录 |
| ts-rest adapter 在某些边界（如 multipart upload）退化为 `unknown` | 中 | 中 | B10 之前先在 B1 用一个 endpoint 验证 multipart 路径；如真退化，给 adapter 加 `parseMultipart` 分支 |
| Session middleware commit 时机错位导致登录态丢失 | 中 | 高 | A3 配专项 e2e 测试；保留旧实现作为 fallback 一周 |
| 编辑器自动保存（B14）状态机不一致 | 中 | 高 | B14 在所有其他域稳定 2 周后做；1 周观察期；feature flag 可瞬间回滚到旧路径 |
| URL 形态从 `/api/actions/admin/listUsers` 改为 `/api/admin/users` 后监控告警失效 | 高 | 低 | Phase B 每个 PR 同步更新告警 + 30 天 301 redirect |
| 客户端 bundle 因引入完整 `apiContract` 而膨胀 > 100KB gzipped | 低 | 中 | 实测后决定是否拆 `apiContractPublic` / `apiContractAdmin`；分 chunk 通过 Vite manual chunks |
| ts-rest 类型推导在嵌套 router 上层层退化 | 低 | 中 | 早期 PR（B1-B3）在 IDE 里抽样验证 hover 类型；如有问题报 issue 给 ts-rest |
| 4 个 RR `<Form>` action（评论提交 / 登录 / 安装×2）在 Hono context bridge 下错位 | 低 | 高 | 这些保留为 RR `action`，通过 `loadContext` 读 session；Phase A3 配 e2e 测试 |
| `tests/contract.cookie.test.ts` / `tests/contract.tailwind-tokens.test.ts` 等锁路径合同测试断言失败 | 高 | 低 | 每个相关 PR 同步更新合同测试断言 |
| AGENTS.md / Skills 配置长期不一致 | 高 | 低 | D2 必须在 D1 之前合并；Phase 完成时 README + AGENTS.md 同 PR 更新 |
| `react-router-hono-server` 因维护风险后续停更 | 低 | 中 | 它本质是 ~200 行胶水，必要时可项目内 vendor 化 |
| ts-rest 突发 breaking change（v4.x → v5.x） | 低 | 中 | 锁定主版本；升级时走专项 PR；契约定义稳定，迁移成本可控 |

---

## Part 13 — 验收标准

### Phase A 退出

- `vp dev` 通过 Hono entry 启动，所有现有 URL 仍可访问
- `vp build && docker build` 产物可部署，启动正常
- session 在 Hono middleware 注入，RR loader 通过 `context.session` 读取
- 现有测试套件零回归
- `/docs` 可访问，OpenAPI spec 生成正常（虽然此时契约还是空树）

### Phase B 每个 PR 退出

- 该域所有端点通过 ts-rest 契约提供服务
- 客户端调用点改用 `api.<domain>.x(...)`，TypeScript 编译通过
- 旧 `routes/api/actions/<domain>.*.ts` 删除
- 30 天 301 redirect 已挂上
- 该域的 unit / contract / e2e 测试全绿
- IDE 中对契约对象 hover 显示完整类型（无 `any` 退化）

### Phase C 退出

- 外部订阅者访问的 URL 全部保留（feed / sitemap / OG / calendar / avatar）
- 输出字节级对比与迁移前一致（fixture 测试）

### Phase D 退出

- `git grep "API_ACTIONS\|api-types\|api-envelope\|defineApiAction\|useApiFetcher"` 命中 0
- `routes/api/` 目录不存在
- `routes.ts` 行数 < 80
- `AGENTS.md` 的 "src/server/" 章节列出 `server/http/` 作为 API perimeter
- 新增的契约测试 + 类型测试在 CI 中运行
- 权限矩阵审计：打开 `server/http/app.ts` 一个文件能读出所有端点的鉴权要求

---

## Part 14 — 立即动作

不必一次性开 10 个 PR。**第一步只做一件事**：

### Phase A1 spike（3-5 天）

验证 `react-router-hono-server` + Vite+ + ts-rest 在本项目落地是否顺畅。

**Spike 产出物**：

1. 一个 PR 分支 `spike/hono-shell`
2. `src/entry/server.node.ts` 最小实现（Hono 包 RR，无任何 API）
3. `src/server/http/ts-rest-adapter.ts` 完整实现 + 1 个示范 endpoint
   （`account/updateProfile`，移植自现有 `routes/api/actions/account.updateProfile.ts`）
4. `src/shared/contracts/_base.ts` + `account.ts`
5. `src/client/api/client.ts` + 1 个调用点改造
6. 在 `/docs` 看到 1 个端点的 OpenAPI 描述
7. dev / build / Docker 三件套验证
8. **决策文档**（保存为 `docs/hono-spike-notes.md`）：
   - HMR 体感（迁移前 vs 后秒级对比）
   - 构建产物大小变化
   - 启动时间变化
   - 踩到的坑与对策
   - 决策建议：go / no-go

**Spike 通过 → 按本计划推进。**

**Spike 失败 → 退回到"`apiEndpoint` 自建 + tRPC 单挂 RR resource route"**
（之前讨论的次优方案，损失 3-5 天 spike 时间）。

---

## 附录 A — 命名与术语统一表

| 术语 | 含义 | 出现位置 |
|---|---|---|
| Contract | ts-rest router 对象，定义一组端点的 path/method/schema/responses | `shared/contracts/**` |
| Controller | 实现一个 Contract 的对象，每个 key 对应契约里的一个 endpoint | `server/http/controllers/**` |
| Service | 业务逻辑函数，与通信无关 | `server/<domain>/service.ts`（不变） |
| Guard | RBAC + 鉴权 middleware | `server/http/guards.ts` |
| Resource Router | 非 ts-rest 的原生 Hono router，用于二进制 / XML 输出 | `server/http/resources/**` |
| ApiContract | 整棵契约树，前后端共享的唯一真相 | `shared/contracts/index.ts` |
| Endpoint | 契约中的一个具体路由声明 | 契约文件内 |

## 附录 B — 与 `AGENTS.md` 现有规则的关系

迁移期间和迁移完成后需要在 `AGENTS.md` 中做的调整：

1. **"Architecture" 章节** 增加 "Server HTTP Layer" 子节，描述 Hono + ts-rest
   组织。
2. **"`src/server/`" 章节** 增加 `server/http/` 子项，明确它是 API perimeter，
   与 `server/middleware/` 并列。
3. **"`src/shared/`" 章节** 增加 `shared/contracts/` 子项，明确它是前后端
   共享的契约层。
4. **"Routing And Data" 章节** 重写：RR loader/action 仅用于页面；非页面请求
   走 ts-rest 契约。
5. **"Sessions, Env, And Security" 章节** 更新 session 入口为 Hono middleware；
   CSRF 描述更新为 mutation 路由专用 middleware。
6. **新增 "API Layer" 章节**：描述契约/Controller/Guard 三段式 + URL 命名约定 +
   错误响应约定。
7. **新增 "Permission Matrix" 章节**：指向 `server/http/app.ts` 作为唯一的
   权限矩阵真相源。
8. **"Editing Guidance — Defensive Constraints" 章节** 追加：
   - 不要在 controller 里写业务逻辑——只编排 service 调用
   - 不要在 service 里抛 `HTTPException`——抛 `DomainError`，由
     `onError` 映射
   - 不要绕过 `apiContract` 直接添加 Hono 路由（资源路由除外，列在 Part 6）
   - 不要在客户端代码里 `fetch('/api/...')` 字符串拼接——必须走
     `api.<domain>.x(...)`

## 附录 C — 与现有 Skill 的关系

| Skill | 影响 | 处理 |
|---|---|---|
| `react-router-framework-mode` | 仍适用（loader / action / meta / 组件） | API 部分从引用集移除 |
| `vercel-react-best-practices` | 不变 | — |
| `vercel-composition-patterns` | 不变 | — |
| `shadcn` | 不变 | — |
| `tailwind-design-system` | 不变 | — |
| `web-design-guidelines` | 不变 | — |

新增 skill candidate：`ts-rest-contracts`（描述契约 / Controller / Guard
约定与最佳实践）。等迁移完成后再正式立项。
