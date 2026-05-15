# Hono 迁移后架构评审报告

> 评审范围：`feature/hono-server` 分支全栈代码  
> 评审维度：类型安全、架构分层、API 设计、安全、数据一致性、可观测性、运维、测试  
> 严重级别：P0（生产风险）/ P1（架构债务）/ P2（工程规范）

---

## 执行摘要

Hono 迁移在 HTTP 层分离上做得正确——Hono 拦截所有 API/资源请求，React Router 仅负责页面渲染，耦合点只剩 `getLoadContext()`。自定义 ts-rest 适配器在类型层面也足够健壮，Zod v4 的 `output<T>` 用法正确。

**但当前代码存在 1 个 P0 安全漏洞、多个 P1 架构断层，以及大量 P2 工程规范缺失。** 主要问题集中在：

1. **评论控制器公开暴露管理接口**（P0 安全漏洞）
2. **控制器类型不一致**——部分用 `ContractImpl`，部分手写类型，部分完全没有类型
3. **事务边界严重不足**——CMS 写操作跨多表但缺乏事务保护
4. **契约响应几乎全是 `z.any()`**——类型安全名存实亡
5. **运营中间件完全缺失**——无健康检查、无请求日志、无安全头、无超时

---

## P0 — 生产风险

### P0.1 `comment.controller.ts` 管理接口零鉴权公开暴露

**位置**: `src/server/http/controllers/comment.controller.ts` + `src/server/http/app.ts:138`

**问题**: `commentController` 被 `publicRoute` 挂载，其中包含以下端点且**没有任何身份校验**：

```ts
// 任何人都能调用
approve: async ({ params }) => {
  await approveComment(params.rid)   // 通过任意评论
  return { status: 200, body: null }
},
delete: async ({ params }) => {
  await deleteComment(params.rid)    // 删除任意评论
  return { status: 200, body: null }
},
loadAll: async ({ body }) => {
  // 返回所有评论（含待审核）
}
```

**影响**: 未登录用户即可删除、审核、批量导出全站评论。这是**活跃的安全漏洞**。

**修复**:
- 将 `commentContract` 拆分为三个独立契约：
  - `commentPublicContract` — likes, avatar, reply, loadComments
  - `commentSelfContract` — token revoke, myComments, updateOwn, requestDeleteOwn
  - `commentAdminContract` — approve, delete, edit, loadAll, searchPages, searchAuthors
- 分别挂载：`publicRoute` / `authedRoute` / `adminRoute`
- 为所有控制器添加 `ContractImpl<typeof contract>` 注解

---

### P0.2 CMS 写操作缺乏事务保护

**位置**: `src/server/cms/pages/service.ts`, `src/server/cms/posts/service.ts`

**问题**: `saveDraft` / `publishLatest` 的执行路径涉及：
1. `content` 表插入/更新
2. `post` / `page` 表元数据更新
3. `syncLibraryImageBlocks` — 同步图片引用
4. `indexPost` / `removePostIndex` — 搜索索引更新
5. `ensureTagsExist` — 标签自动创建

这些步骤在**无事务**的情况下顺序执行。第 3 步或第 4 步失败后，数据库处于半完成状态，且搜索索引与 DB 不一致。

**当前事务使用情况**（全项目仅 4 处）：
```
src/server/db/query/like.ts:24	src/server/db/query/category.ts:107
src/server/cms/revision/repository.ts:74	(saveDraftRevision)
src/server/cms/revision/repository.ts:172	(publishLatestRevision)
```

只有 `revision/repository.ts` 使用了事务，但上层的 `service.ts` 在事务外执行了 `syncLibraryImageBlocks` 和 `indexPost`。

**修复**:
- 将 `syncLibraryImageBlocks` 和 `indexPost` 的调用移入事务回调内，或在事务成功后异步触发（最终一致性）
- 对于无法纳入 DB 事务的操作（如 S3 上传、搜索索引），采用 Saga 模式：成功提交 DB 后再执行副作用，失败时写入补偿任务队列

---

### P0.3 分类/标签列表的 N+1 查询

**位置**: `src/server/categories/service.ts`, `src/server/tags/service.ts`

**问题**: `listCategoriesForAdmin` 和 `listTagsForAdmin` 在返回列表后，逐条查询每个分类/标签关联的文章数量。当分类/标签数量达到数百时，会产生数百次额外查询。

**修复**: 使用 `GROUP BY` + `COUNT` 的批量查询替代逐条查询。

---

### P0.4 `ensureTagsExist` 竞态条件

**位置**: `src/server/cms/posts/service.ts:53`

```ts
async function ensureTagsExist(tagNames: string[]): Promise<void> {
  await Promise.all(tagNames.map((name) => seedTagIfMissing({ ... })))
}
```

**问题**: 并行创建标签，无事务保护。两个并发请求同时创建同名标签时，`seedTagIfMissing` 的 "先查后插" 逻辑会产生唯一约束冲突。

**修复**: 使用 `INSERT ... ON CONFLICT DO NOTHING` 或将 `ensureTagsExist` 纳入上层事务。

---

## P1 — 架构债务

### P1.1 控制器类型不一致

**问题**: 19 个控制器中，类型安全程度参差不齐：

| 控制器 | 类型注解 | 状态 |
|---|---|---|
| `adminPagesController` | `ContractImpl<typeof adminPagesContract>` | ✅ |
| `adminPostsController` | `ContractImpl<typeof adminPostsContract>` | ✅ |
| `adminUsersController` | `ContractImpl<typeof adminUsersContract>` | ✅ |
| `commentController` | **无注解，458 行手写类型** | ❌ |
| `accountController` | **无注解，手写内联类型** | ❌ |
| `analyticsController` | **无注解，手写内联类型** | ❌ |
| `imageController` | **无注解** | ❌ |
| `musicController` | **无注解** | ❌ |

**影响**: 契约变更时，无注解的控制器不会触发编译错误，导致契约漂移。

**修复**: 为所有控制器统一添加 `ContractImpl<typeof contract>`。对于已经类型安全但无注解的，只需加一行 `satisfies`。

---

### P1.2 契约响应几乎全是 `z.any()`

**位置**: `src/shared/contracts/admin/*.ts`（除 pages/posts 外）

**问题**: 绝大多数 admin 契约的 `responses: { 200: z.any() }`。这意味着：
- ts-rest 适配器不做响应验证（当前确实不做）
- OpenAPI 文档生成的 schema 为空
- 客户端 `initClient` 返回的 body 类型为 `any`
- 契约作为"客户端-服务端唯一可信接口"的价值丧失

**修复**: 逐领域定义响应 DTO schema。以 `adminPagesContract` 和 `adminPostsContract` 为模板——它们已经使用了 `listPagesSchema`、`savePageBodySchema` 等真实 schema。

---

### P1.3 `commentController` 是 God Object

**位置**: `src/server/http/controllers/comment.controller.ts`（458 行）

**问题**: 单一控制器混合了 6 个不同领域：
1. 点赞（public）
2. 头像查询（public）
3. 评论发表与加载（public）
4. Token 管理（anonymous visitor）
5. 自服务编辑/删除请求（authenticated visitor）
6. 管理审核/删除/批量查询（admin）

此外，控制器直接调用 DB query 函数（`findMetricByPublicId`、`findCommentsByIds`、`countMyComments` 等），而不是通过 service 层。

**修复**: 按领域拆分为 3 个控制器 + 3 个 service。

---

### P1.4 `adminRendersController` 越界职责

**位置**: `src/server/http/controllers/admin/renders.controller.ts:51`

**问题**: `reindexSearch` 端点属于 "渲染" 控制器，却执行：
- 原始 Drizzle SQL 查询 `post` + `content` 表
- 批量搜索索引重建
- 进度追踪（processed/failed/total/nextOffset）

这是搜索领域的批处理作业，不应由渲染控制器拥有。

**修复**: 提取到 `src/server/search/reindex-service.ts`，控制器仅做权限检查和参数透传。

---

### P1.5 `ViewerContext | null` 的类型窄化缺失

**位置**: `src/server/http/ts-rest-adapter.ts` + 所有 admin 控制器

**问题**: `HandlerContext.viewer` 被统一类型为 `ViewerContext | null`。在已经通过 `requireAuth` / `requireRoleMw` 的路由上，viewer 实际上不可能为 `null`，但类型系统不知道这一点。导致每个控制器都要写：

```ts
if (!viewer) return { status: 401, ... }
const post = await savePostDraft({ authorId: BigInt(viewer!.userId) })
```

这种 "先检查再断言" 是 TypeScript 反模式。

**修复**: 适配器暴露两个上下文类型：
- `PublicHandlerContext` — `viewer: null`
- `AuthedHandlerContext` — `viewer: ViewerContext`

`authedRoute` / `adminRoute` / `authorRoute` 的 `ContractImpl` 自动使用 `AuthedHandlerContext`。

---

### P1.6 错误处理实现不一致

**位置**: `src/server/http/errors.ts`

**问题**: `onErrorHandler` 混合了两种响应构造方式：

```ts
// HTTPException / ActionFailure / DomainError: 手动 new Response
return new Response(JSON.stringify(payload), { status: err.status, headers: { 'Content-Type': 'application/json' } })

// ZodError / 未知错误: 使用 c.json()
return c.json({ error: { ... } }, 400)
```

差异点：
- `new Response` 分支**不会**自动附加 `X-Request-Id`
- `ActionFailure` 的 headers 处理发生在 `c.header()` 之后，但返回的是全新 `Response`，可能丢失 Hono 上下文已设置的其他头
- `HTTPException` 分支没有设置 `X-Request-Id`

**修复**: 统一使用 `c.json()`，或在 `new Response` 前显式收集所有需要附加的 header。

---

### P1.7 双 error handler 注册

**位置**: `src/server.ts:20` + `src/server/http/app.ts:46`

**问题**: `onErrorHandler` 同时在根 Hono 实例和 API 子路由器上注册。API 子路由器上的 handler 永远不会被触发（错误会冒泡到根实例）。

**修复**: 移除 `app.ts` 中的冗余注册。

---

### P1.8 CSRF Guard 重复解析 Body

**位置**: `src/server/http/csrf.ts` + `src/server/http/ts-rest-adapter.ts`

**问题**: `csrfGuard` 对 JSON/form 请求调用 `c.req.json()` / `c.req.parseBody()` 提取 token；随后 ts-rest 适配器的 `readBody()` 再次解析同一请求体。Hono 的 `c.req` 不支持 body replay，两次读取在某些场景下会失败或浪费资源。

**修复**: 在适配器的 `readBody()` 中将解析后的 body 存入 `c.var.parsedBody`，CSRF guard 从 `c.var` 读取。或改在适配器验证阶段后提取 CSRF token。

---

### P1.9 服务层错误词汇不统一

**位置**: 全项目 service 文件

**问题**: 部分 service 函数抛出 `ActionFailure`（HTTP 感知的），部分抛出 `DomainError`（领域感知的），部分直接 `throw new Error()`。控制器和错误处理器需要同时处理三种词汇。

**修复**: 服务层**只**使用 `DomainError`。`ActionFailure` 限制在控制器/适配器层使用。统一迁移后，`onErrorHandler` 可以简化。

---

### P1.10 `server.ts` 中的类型强转

**位置**: `src/server.ts:20`, `src/server.ts:66`

```ts
app.onError(onErrorHandler as unknown as Parameters<typeof app.onError>[0])
buildRouteContexts(c as any)
```

**问题**: `onErrorHandler` 的签名 `(err: Error, c: Context<Env>) => Response` 与 Hono 的 `ErrorHandler` 存在泛型不匹配，需要 `as unknown` 绕过。`getLoadContext` 接收的 Hono Context 与项目自定义的 `Env` 不兼容。

**修复**: 精确调整 `Env` 类型定义，或引入类型桥接函数消除 `as any`。

---

### P1.11 页面/文章服务中的进程级缓存缺乏失效保障

**位置**: `src/server/cms/pages/service.ts:91`, `src/server/cms/posts/service.ts:79`

**问题**: `cachedPages` 和 `cachedPostMetas` 是模块级变量，通过 `subscribeCatalogInvalidate` 订阅失效事件。但在多进程部署（如 Docker 多副本）中，进程间不会共享订阅通道，一个实例的写入不会触发另一个实例的缓存失效。

**影响**: 多副本部署时，管理员修改内容后，部分实例可能持续返回旧数据最多 60 秒。

**修复**: 缩短 TTL 至 5-10 秒，或使用 Redis 作为分布式缓存同步层。

---

## P2 — 工程规范

### P2.1 运营中间件完全缺失

**位置**: `src/server.ts`

| 能力 | 状态 | 影响 |
|---|---|---|
| 健康检查 `/health` | ❌ 缺失 | K8s/负载均衡无法做存活探测 |
| 请求访问日志 | ❌ 缺失 | 无法追踪请求延迟、错误率 |
| 请求超时 | ❌ 缺失 | 慢查询可能拖垮整个 worker |
| Body 大小限制 | ❌ 缺失 | 大文件上传可能耗尽内存 |
| 安全头 (Helmet) | ❌ 缺失 | XSS、点击劫持等基础防护缺失 |
| 压缩 (gzip/brotli) | ❌ 缺失 | 响应体积未优化 |
| CORS | ❌ 缺失 | 目前依赖同源策略，未来 API 开放时被动 |
| Prometheus 指标 | ❌ 缺失 | 无 QPS/延迟/错误率监控 |

**修复**: 在 `server.ts` 的 `configure()` 中按顺序添加：
1. `hono/compress` — 响应压缩
2. `hono/secure-headers` 或自定义安全头中间件
3. 请求日志中间件（记录 method, path, status, duration, requestId）
4. Body 大小限制（`c.req.raw.body` 的 limit，或 Hono 原生限制）
5. `/health` 和 `/ready` 端点

---

### P2.2 SSE 端点内联在 `app.ts` 中

**位置**: `src/server/http/app.ts:55-135`

**问题**: `/api/analytics/events` 是原生 Hono 路由，直接内联在 `createApiApp()` 中，长度 80 行。它与 ts-rest 契约系统完全脱节，且包含：
- DB 查询逻辑 `queryRealtimeTail`
- 定时器管理（`setInterval`）
- SSE 协议细节（encoder, stream, heartbeat）

**修复**: 提取为 `src/server/http/resources/analytics-events.ts`，与 `feedRouter`/`imagesRouter` 同级。考虑使用 `hono/streaming`  helper 简化 SSE 实现。

---

### P2.3 限流策略散落在控制器中

**位置**: `src/server/http/controllers/comment.controller.ts`, `src/server/http/rate-limit.ts`

**问题**: `src/server/http/rate-limit.ts` 导出了可复用的限流中间件工厂，但 `app.ts` 中没有任何路由使用它。限流逻辑以 ad-hoc 形式内联在控制器中：

```ts
const limit = await tryLikeIncreaseRateLimit(clientAddress)
if (limit.exceeded) { ... }
```

**修复**: 将限流提升为声明式中间件，在 `guards.ts` 中提供 `withRateLimit()` 高阶函数，统一应用于公共变异端点。

---

### P2.4 `unwrap()` 的硬编码成功状态码

**位置**: `src/client/api/unwrap.ts`

```ts
export async function unwrap<T extends { status: number; body: unknown }>(
  promise: Promise<T>,
): Promise<Extract<T, { status: 200 | 201 | 204 }>['body']> {
```

**问题**: `200 | 201 | 204` 是 hardcoded 的。如果契约定义了 `201 Created` 或 `204 No Content` 以外的成功状态（如 `202 Accepted`），`unwrap()` 会将其视为错误抛出。

**修复**: 将成功判定改为 `status >= 200 && status < 300`，类型提取改为 `T extends { status: infer S } ? S extends number ? (S >= 200 && S < 300 ? T : never) : never : never`（或更简单地在运行时判断后 `as` 转换）。

---

### P2.5 审计日志仅输出到 stdout

**位置**: `src/server/logger.ts`

**问题**: 代码注释明确承认：

> "Today they go to stdout only — the same place every other log line lands — which is placeholder behaviour."

审计日志（`audit.cms.pages`、`audit.user` 等）在合规场景下不可信任。

**修复**: 引入 `audit_log` DB 表 + `recordAuditEvent()` helper，写入 DB 后再输出日志。

---

### P2.6 测试覆盖率阈值偏低

**位置**: `vite.config.ts`

```ts
thresholds: { lines: 70, branches: 60, functions: 70, statements: 70 }
```

**问题**: branches 阈值仅 60%，对于 CMS 和权限控制代码来说安全边际不足。

**修复**: 逐步将 branches 提升至 75-80%，并添加控制器层单元测试（目前测试主要集中在 contract、route 集成和 service 层）。

---

### P2.7 API 路径不符合 REST 惯例

**位置**: `src/shared/contracts/admin/*.ts`

**问题**: 管理端路径使用动词命名：
- `/admin/list-posts`
- `/admin/get-post/:id`
- `/admin/delete-post/:id`
- `/admin/save-draft`

**修复**: 迁移到资源导向的路径：
- `GET /admin/posts` → list
- `GET /admin/posts/:id` → get
- `DELETE /admin/posts/:id` → delete
- `POST /admin/posts/:id/drafts` → save draft
- `POST /admin/posts/:id/publish` → publish

---

### P2.8 Barrel 文件违反项目规范

**位置**: `src/server/session.ts`

**问题**: AGENTS.md 明确禁止 barrel 文件（`bundle-barrel-imports`），但 `src/server/session.ts` 存在且被多处引用。它纯为 re-export，增加了导入跳转层级。

**修复**: 内联实际导入路径，删除 barrel 文件。

---

## 优化路线图

### Phase 1 — 止血（1-2 天）
1. **拆分 `commentController` 并修复权限挂载**（P0.1）
2. **为所有 controller 添加 `ContractImpl`**（P1.1）
3. **统一 `errors.ts` 使用 `c.json()`**（P1.6）
4. **移除冗余的 `app.onError`**（P1.7）

### Phase 2 — 数据一致性（3-5 天）
1. **为 CMS save/publish 添加事务边界**（P0.2）
2. **修复 `ensureTagsExist` 竞态条件**（P0.4）
3. **修复分类/标签 N+1**（P0.3）
4. **统一服务层错误词汇为 `DomainError`**（P1.9）

### Phase 3 — 契约硬化（5-7 天）
1. **为所有 admin contract 定义真实 response schema**（P1.2）
2. **将 `GuardedHandlerContext` 窄化类型引入适配器**（P1.5）
3. **修复 `server.ts` 类型强转**（P1.10）
4. **迁移 admin 路径到 REST 资源导向命名**（P2.7）

### Phase 4 — 运维基建（并行）
1. **添加健康检查、安全头、压缩、请求日志**（P2.1）
2. **提取 SSE 端到独立 resource router**（P2.2）
3. **声明式限流中间件**（P2.3）
4. **审计日志持久化到 DB**（P2.5）

---

## 附录：当前事务使用清单

```
❌ src/server/cms/pages/service.ts      — 无事务（saveDraft/publishLatest 跨多表）
❌ src/server/cms/posts/service.ts      — 无事务（同上）
❌ src/server/comments/loader.ts       — 无事务（createComment 跨 comment + metric + token）
❌ src/server/tags/service.ts           — 无事务（upsertAdminTag 查重+插入）
❌ src/server/categories/service.ts     — 无事务（upsertAdminCategory 同上）
❌ src/server/images/service.ts         — 无事务（deleteImage 删 DB + 删 S3）
✅ src/server/db/query/like.ts         — db.transaction
✅ src/server/db/query/category.ts     — db.transaction
✅ src/server/cms/revision/repository.ts — db.transaction (saveDraftRevision)
✅ src/server/cms/revision/repository.ts — db.transaction (publishLatestRevision)
```

---

*报告生成时间: 2026-05-15*  
*评审分支: feature/hono-server*
