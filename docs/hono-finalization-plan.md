# 最终 Plan：Kimi 分支收尾 → 1.0

> 基础提交：`9e08a66 fix(server): intercept leaked Response objects to prevent dev-server crash`
> 工作分支：`kimi-review`（追踪 `origin/feature/hono-server`）
> 参考蓝图：`docs/hono-api-migration-plan.md`（保留为长期规约；本 Plan 是其收尾增量）

本文档是在 `feature/hono-server`（Kimi 分支）的实际状态上，按
`docs/hono-api-migration-plan.md` 逐项审计后给出的收尾计划。不替代原
Plan，只把"未完成项 + 偏离项"拉成可执行的 PR 列表。

---

## Part 0 — 接手现状审计

### 0.1 与原 Plan 的实际差距

| 项目 | 原 Plan 要求 | 当前 Kimi 实际 | 差距 |
|---|---|---|---|
| `z.custom<>()` 输出 schema | 禁止（§3.1、§3.4） | **48 处**，遍布 15 个契约文件 | ✗ |
| `commonResponses: { 500: errorResponse }` | 所有契约 spread（§3.5） | **0/21 个契约** | ✗ |
| `admin` 嵌套 router | `admin: c.router({ users, posts, ... })`（§3.5） | `{...adminUsersContract, ...adminPostsContract}` 扁平 spread | ✗ |
| `pathPrefix: '/api'` 位置 | `index.ts` 契约层（§3.5） | `app.basePath('/api')`，契约层无 | △ |
| `strictStatusCodes` | 所有契约 | 21/21 | ✓ |
| 适配器入参类型流 | `ContractImpl<R>` 端到端推断（§4.3） | `ContractImpl<R>` + `SchemaOutput<>` | ✓ |
| 输出运行时校验 | strictStatusCodes 真正契约严格性（§3.4） | 适配器未对 response body 跑 schema | ✗ |
| CSRF 中间件 | `csrfGuard` 自动挂在 mutation 路由（§5.4） | 已自动注入 `authedRoute/roleRoute` | ✓ |
| CSRF 实现 | 一处中间件 | 中间件 + `comment-public` 内联一次（双重） | △ |
| Body 双读风险 | — | csrfGuard `c.req.json()` + adapter `req.text()`：依赖 Hono 缓存，multipart 不缓存 | ⚠ |
| Hono / RR 集成 | `react-router-hono-server`（§10.2） | `createHonoServer` | ✓ |
| 适配器单测 | §9.2 controller 单测 | 适配器自测 ✓；controller 单测 0/21 | ✗ |
| 类型测试 | §9.4 `ClientInferResponseBody` | 3 个端点 | △ |
| E2E `testClient` | §9.3 | 0 | ✗ |
| 旧 `/api/actions/*` 301 | §11 Phase D | 已挂，但有 bug：camelCase 转 kebab-case，新契约路径用 resource-style，转完打不中 | ✗ |
| `apiContract.auth` gate | 未指定 | 全契约 `adminRoute`（实际只有 1 个 admin-update 端点），命名误导 | △ |
| `softDelete` 返回码 | 204 + `c.noBody()`（§3.4） | 200 + `{success:true}` | △ |
| 旧客户端 `api-actions/envelope/types/fetcher` | §2.2 全删 | 已全删 | ✓ |
| `routes/api/actions/**` | §2.2 全删 | 已全删 | ✓ |
| 资源路由（Plan §6） | feed/sitemap/images/tags/search | 仅 4 个；tags/search 走 server.ts 行内 redirect | △ |

### 0.2 三类差距分级

- **P0（阻塞合入 main）**：z.custom 全清、commonResponses 全加、admin 嵌套、Body 双读修复、Legacy 301 bug。
- **P1（合入前必须，但可独立 PR）**：response 运行时校验、E2E testClient、controller 单测、softDelete 改 204、tags/search 资源化、auth contract 拆出。
- **P2（合入后再做）**：类型测试加厚、OpenAPI examples、性能 baseline。

---

## Part 1 — 修订后的设计目标

保留原 Plan §0.4 终局，但显式补充三条：

1. **契约严格性 = 输入 + 输出双向 Zod 校验**。原 Plan 强调 strictStatusCodes，但适配器没落地输出校验。本次补齐。
2. **`api.<domain>.<resource>.<verb>` 三段式调用为唯一形态**。扁平 spread 是死路（命名空间冲突 + 客户端语义弱），契约层必须嵌套。
3. **CSRF 是中间件，不是控制器代码**。`comment-public` 里残留的内联 csrf 校验是 Plan B5 迁移过程中的痕迹，删干净。

---

## Part 2 — PR 拆分

每个 PR 自带：`vp check` + `vp test run` + 至少一条 E2E 验证。
标 ⚡ 的是不可拆分必须一次完成的"重型 PR"。

### Phase F1 — 契约严格化（P0，3 PR，~3 天）

#### **F1.1** ⚡ z.custom 全清 + commonResponses 全加

- 删除 `import type { AdminUserDto }` 风格的"输出类型从外面拉"模式。
- 把 `z.custom<AdminUserDto>()` 一律替换为就地定义的 Zod schema（参照 `src/shared/users.ts` 的 `AdminUserDto` interface 逐字段还原）。
- 每个契约根 `c.router(..., { strictStatusCodes: true, commonResponses: { 500: errorResponse } })`。
- 涉及的 DTO 提取到 `src/shared/contracts/_dtos.ts`：`adminUserDto`、`adminPostDto`、`adminPageDto`、`adminCommentDto`、`adminFriendDto`、`adminCategoryDto`、`adminTagDto`、`adminImageDto`、`adminMusicDto`、`adminSessionDto`、`commentItemDto`。
- 验收：
  - `grep -rn "z.custom" src/shared/contracts/ | wc -l` → `0`
  - `grep -rl "commonResponses" src/shared/contracts/ | wc -l` → `≥21`
  - OpenAPI dump 不再出现 `{}` 空 schema。
- 风险：中。运行时行为不变，但 IDE 类型推断会变严格——客户端某处依赖不在 schema 里的字段会 TS 报错。这是预期效果。

#### **F1.2** admin 嵌套化

- `src/shared/contracts/admin/index.ts` 改成：
  ```ts
  export const adminContract = c.router({
    users: adminUsersContract,
    posts: adminPostsContract,
    pages: adminPagesContract,
    /* ... */
    renders: adminRendersContract,
  })
  ```
- 重命名子契约 endpoint 短动词（保持向后断链一次性完成）：
  - `listUsers` → `list`, `getUser` → `get`, `muteUser` → `mute`, …
  - 60+ 处调用站点用 codemod 改：`api.admin.listUsers(` → `api.admin.users.list(`。
- 把 `src/server/http/app.ts` 的 12 行 per-domain 挂载改用 `apiContract.admin.<sub>` 引用契约。
- 验收：
  - `grep -rEoh "api\.admin\.[a-zA-Z]+" src/ui src/client src/routes | sort -u` 应只出现 `api.admin.<domain>` 形式。
  - `vp check` 通过。
- 风险：高（调用站点 60+）。但全靠 TS 编译器导航，做完不会 silent break。

#### **F1.3** softDelete 改 204 + apiContract.auth 拆并改名

- `admin/users` `softDelete`: 204 + `c.noBody()`。其他几个 admin `delete` 同步。
- `apiContract.auth` 当前只挂了 `updateUser`，名字误导。合并到 `apiContract.admin.users.update`（PATCH `/admin/users/:id`），删 `auth` contract / controller / route file。
- 风险：低。

### Phase F2 — 适配器加固（P1，2 PR，~2 天）

#### **F2.1** Response 运行时校验

- 在 `mountContract → mountRoute` 的 `routeHandler` 内：拿到 `result` 后，根据 `result.status` 在 `route.responses[result.status]` 找对应 schema，若存在则 `safeParse(result.body)`。
- 失败行为：
  - `import.meta.env.DEV` → 抛 500（带 issue 列表）。
  - prod → `getLogger('http.response-mismatch').warn({...})`，原样放行。
- 这才是 strictStatusCodes 在 runtime 真正闭环。验收：
  - `tests/server.http.ts-rest-adapter.test.ts` 新增 `it('rejects response that mismatches schema (dev)')`。

#### **F2.2** CSRF / Body 双读修复

- `csrfGuard` 改为：**不读 body**。把 csrf token 来源放进自定义 header `X-CSRF-Token`（继续兼容 body.csrf 作为 fallback，但 fallback 路径用 `req.raw.clone().json()` 而非 `c.req.json()`，避免触发 Hono 内部缓存）。
- 客户端 ts-rest client 默认带上 `X-CSRF-Token` header（从 `<meta name="csrf-token">` 读或第一次响应回写 cookie）。
- 删除 `comment-public.controller.ts` 内联 `validateRequestCsrf`，由中间件接管。
- 验收：
  - `grep -rn "validateRequestCsrf" src/server/http/controllers/ | wc -l` → `0`
  - `tests/contract.cookie.test.ts` 跑过。
  - 新增 `tests/server.http.csrf-guard.test.ts` 至少覆盖 4 用例：缺 token / 错 token / cookie 缺失 / 正常通过。

### Phase F3 — 测试补齐（P1，3 PR，~5 天）

#### **F3.1** Controller 单测（基础 5 个）

新增 `tests/controller.*.test.ts`：
- `controller.account.test.ts`
- `controller.admin-users.test.ts`
- `controller.comment-public.test.ts`
- `controller.admin-posts.test.ts`（含 publish/draft 状态机）
- `controller.admin-cache.test.ts`

写法直接调 controller 对象（`accountController.updateProfile({ body: ... }, mockCtx)`）。mockCtx 抽到 `tests/_helpers/mock-ctx.ts`。

#### **F3.2** E2E `testClient`（关键路径 6 条）

新增 `tests/e2e.permission-matrix.test.ts`：
- 匿名访问 `account.*` → 401
- visitor 访问 `admin.users.list` → 403
- admin 访问 `admin.users.list` → 200
- admin mute 自己 → 403（不能禁言自己）
- 匿名 POST `comment.submit` 缺 csrf → 403
- 匿名 POST `comment.submit` 带 csrf → 200

权限矩阵这条是 Plan §0.2 第 4 条需求（"接口权限管理是一等公民"）的实证。

#### **F3.3** 类型测试加厚

把当前 3 行 `ClientInferResponseBody` 扩成每个契约一个 it（约 21 条）。新增 `ClientInferRequest` 用例覆盖路径参数 / query / body 三种形态。

### Phase F4 — 资源路由 & 收尾（P1，2 PR，~2 天）

#### **F4.1** tags / search 资源化

把 `src/server.ts` 里行内的 `app.get('/tags', ...)` 与 `app.get('/search', ...)` 移到 `src/server/http/resources/redirects.ts`，与 feed/sitemap/images/analytics-events 并列。Plan §6.4 明确这两个走资源路由。

#### **F4.2** Legacy 301 redirect bug 修复

当前 `app.all('/api/actions/*', ...)` 把 camelCase 转 kebab-case，但新契约路径是 resource-style（`/admin/users` 不是 `/admin/list-users`）。修复方式：建一张显式 map（`src/server/http/legacy-redirects.ts`）保存旧端点 → 新 endpoint 名 + method 的映射；不在的旧路径返回 410。

map 量级 ~92 条（旧端点数），机械活，从 Plan §11.B 表格可推出。

### Phase F5 — 文档与守护（P2，2 PR，~1 天）

#### **F5.1** AGENTS.md 修订

当前 AGENTS.md 已更新 Architecture / `src/server/` / `src/client/` 三章。还缺：
- **"如何加一个新 API endpoint"小节**：3 步骤——加契约、加 controller 方法、UI 调用。
- **"权限矩阵"小节**：列出 `publicRoute / authedRoute / roleRoute` 三个工厂的语义。
- 把 `bundle-barrel-imports` / `architecture-avoid-boolean-props` 这些 rule id 在 Hono 上下文重述一次（contract 文件不能 barrel）。

#### **F5.2** 守护测试

新增 `tests/contract.contract-shape.test.ts`，遍历 `apiContract` 验证：
- 每个 leaf route 的 `responses` 至少含 `200|201|204` 中之一 + `500`
- 每个 mutation route 不能挂在 `publicRoute` 之外且没有 csrf 标记（用 `route.metadata.csrfExempt: true` 显式 opt-out）
- 每个契约都设 `strictStatusCodes: true`

把"评审清单"变成"CI 守护"。

---

## Part 3 — 时间表与里程碑

| 周次 | 内容 | 验收里程碑 |
|---|---|---|
| W1 | F1.1 + F1.2 + F1.3 | `vp check && vp test run` 全绿；OpenAPI 200 schema 完整 |
| W2 | F2.1 + F2.2 + F3.1 | controller 单测覆盖 5 个域；运行时 response 校验生效 |
| W3 | F3.2 + F3.3 + F4.1 + F4.2 | E2E 权限矩阵 6 条全绿；legacy 301 命中率监控 ≥99% |
| W4 | F5.1 + F5.2 + 合入 main | AGENTS.md 完成；CI 守护生效；merge to main |

---

## Part 4 — 测试矩阵

| 测试类型 | 文件前缀 | 当前 | 目标 |
|---|---|---|---|
| 适配器单测 | `tests/server.http.*` | 1 | 3（adapter / csrf / response-schema） |
| Controller 单测 | `tests/controller.*` | 0 | 5（账户、用户、公共评论、文章、缓存） |
| E2E permission matrix | `tests/e2e.permission-matrix.test.ts` | 0 | 1 文件 / 6 用例 |
| 契约 shape 守护 | `tests/contract.contract-shape.test.ts` | 0 | 1 文件 / 3 invariant |
| 类型推断 | `tests/type.contract.test-d.ts` | 3 | 21 + |
| 字节级 URL 稳定性 | `tests/contract.url-stability.test.ts` | 已存在 | 扩到含 legacy redirect map |

---

## Part 5 — 不会做的事（明确边界）

避免范围蔓延，下列不在本次 finalization 范围内：

1. **服务层重写**：Plan §0.3 硬约束。本 Plan 只动 `server/http/` 和契约层。
2. **OpenAPI examples / Postman collection 自动化**：留待 F5 之后。
3. **CSRF 升级到 double-submit-cookie + signed token**：当前模式（cookie + body/header echo）已够用，安全要求未变。
4. **从 ts-rest 切到 `@hono/zod-openapi`**：评估过，迁移成本大于收益（Plan §1.3 表已论证）。
5. **响应体压缩 / brotli 优化**：`hono/compress` 已挂在 `server.ts`，性能 baseline 留到合并后再做。

---

## Part 6 — 风险与回滚

| 风险 | 缓解 |
|---|---|
| F1.1 改 schema 引出隐藏的字段不匹配（如 BigInt 经 JSON.stringify 后变 string） | DTO schema 显式声明 `z.string().regex(/^\d+$/)`；新增 `tests/contract.bigint-serialization.test.ts` |
| F1.2 admin 嵌套导致 SSR loader 中的 api 调用漏改 | 不允许并行做 F1.2；专 PR + 在 CI 上 `tsc --noEmit` 必须过 |
| F2.1 dev 抛 500 把开发体验拉差 | 错误信息必须含 "expected schema vs actual body" 的 diff；prod 静默降级 |
| F2.2 csrf 改 header 后某些老浏览器无 CORS preflight 支持 | 站内同源调用不触发 preflight；保留 body.csrf fallback 一个版本 |
| F4.2 legacy 301 map 漏端点 | 上线后第一周开启 `legacy-redirect-miss` 告警，按日 review |

回滚：每个 PR 独立 revert 即可；F1.1 之后 OpenAPI / 类型推断变严，回滚单 PR 也回不到完整 z.custom 状态——这是预期效果（让重新引入 z.custom 变得"看得见"）。

---

## Part 7 — 执行顺序

推荐顺序：

1. **F1.1**（z.custom 全清 + commonResponses 全加）—— P0 中影响面最大的纯类型改动。
2. **F1.2**（admin 嵌套 + endpoint 重命名）—— 必须紧跟 F1.1，趁 schema 严格化的余热做调用站点重写。
3. **F1.3**（softDelete 204 + auth contract 合并）—— 收尾 P0 部分。
4. **F2.1**（response 运行时校验）
5. **F2.2**（CSRF body 双读 + 内联清理）
6. **F3.1 → F3.3**（测试）
7. **F4.1 → F4.2**（资源路由 + legacy 301）
8. **F5.1 → F5.2**（文档 + 守护）

每完成一个 phase 跑一次 `vp check && vp test run`，绿了再开下一个 PR。
