# 自审报告：RBAC 重构

> 严苛标准下对 `feature/tailwind-enhancement` 分支上自己交付的 RBAC 重构（PR 0-4）的 fine-grained code review。
> 评审基线：[`plans/fancy-hopping-minsky.md`](../../.claude/plans/fancy-hopping-minsky.md)。

---

## 一、自己引入的硬伤（regression）

### R1. `canManageComment` 在 own-routes 里语义错位 ⚠️

`canManageComment(viewer, c)` 的定义是「admin 或本人」。我把它接到了
`comment.{requestDeleteOwn, cancelDeleteOwn, updateOwn}` 三个 **「Own」** 路由里：

```ts
if (!c || !canManageComment(viewer, c)) {
  throw new ActionFailure(404, '资源不存在。')
}
```

但「Own」语义是 **严格本人**，admin 不应该走这条路径（admin 有专属的删除/审核接口）。后果：

- **`cancelDeleteOwn` 直接坏了**：admin 通过守卫之后，
  `clearDeleteRequest(commentId, viewer.userId)` 的 WHERE 子句还要求
  `deleteRequestedBy = viewer.userId`。原发起人不是 admin → 0 行更新 → 抛 409
  「无法撤回删除申请」。守卫和 DB 操作脱节，逻辑半通不通。
- 概念上让 admin 经过 Own 端点是冗余路径，会让审计 log 误把 admin 的操作
  记成「用户自己撤回」。

**正确做法**：own-routes 不要用 `canManageComment`，引入或就地写
`isCommentOwner(viewer, c)`（不含 admin bypass），或者直接保留之前
`c.userId.toString() !== viewer.userId` 的明确写法 + 注释说明为什么不放 admin。
我引入这个抽象是 **为了用而用**，反而出了 bug。

### R2. Layout 降级到 `visitor` 但子路由没补 author/admin 守卫

`wp-admin.layout.tsx:22` 我把 `hasAtLeast(role, 'author')` 改成
`hasAtLeast(role, 'visitor')` 是为了让 visitor 能进 `/my/*`。但
`wp-admin.posts.tsx`、`wp-admin.images.tsx`、`wp-admin.musics.tsx`、
`wp-admin.tags.tsx`、`wp-admin.posts.{new,edit}.tsx` **本来就没有路由级守卫**，
全靠 layout 拦截。降低 layout 门槛之后，visitor 现在可以加载这些页面的
SPA 壳（API 调用会 403，但 UI chrome 已经渲染、CSS 已经下载）。

这是 **纵深防御缺口**。计划里推荐了「方案 X — 把守卫下放到子路由」，但我
只改了 layout 没补下放。

**正确做法**：在 `wp-admin.posts.tsx` 等每个 author+ 路由里补
`requireRole(ctx, 'author')` loader；admin-only 路由（pages、settings 等）补
`requireRole(ctx, 'admin')`。

### R3. `ErrorMessages.NOT_ADMIN` → `FORBIDDEN` 的 UX 退化

我删了 `requireAdminSession`，所有 admin gate 失败都返回通用的
`FORBIDDEN: '禁止访问。'`。原来管理员路径专门有
`NOT_ADMIN: '当前用户不是管理员。'`，能告诉作者「你登录了，但权限不够」。
现在统一退化为「禁止访问」，少了一档可读性。`errors.ts` 里 `NOT_ADMIN`
还留着但没人用 — **死代码**，我应该删掉或重新接回。

### R4. `defineApiAction` 的 `viewer` 类型注入是半成品

```ts
let viewer: ViewerContext | undefined
if (config.requireRole) {
  const user = ctx.session.get('user')
  requireRole({ user, role: user?.role ?? null }, config.requireRole)
  viewer = { userId: user!.id, role: user!.role } // ← 仍然需要非空断言
}
```

`requireRole` 是 `asserts ctx is ...`，但断言只能收窄它 **直接接收的参数**
（一个临时字面量对象），不能反向回到外层的 `user` 变量。我留了两个非空
断言。这件事正是计划要 PR 1.4 解决的「`.id!.role!`」反模式，我换了个
写法但本质问题没消除。

**正确做法**：让 `requireRole` 直接断言 `user` 参数，签名改成
`asserts user is SessionUser`：

```ts
function requireUserRole(user: SessionUser | undefined, min: Role): asserts user is SessionUser {
  if (!user || !hasAtLeast(user.role, min)) throw new ActionFailure(403, ...)
}

// 调用方：
const user = ctx.session.get('user')
requireUserRole(user, config.requireRole)
viewer = { userId: user.id, role: user.role } // ← 不再需要 `!`
```

`admin.uploadImage` 里 `adminUser!.id` / `adminUser!.name` 是同样的问题。

### R5. `wp-admin.welcome` minRole 与 layout 不一致

`AdminShell.tsx:39` 的 `{ to: '/wp-admin/welcome', minRole: 'visitor' }`，
filter 里 `if (item.minRole === 'visitor') return true` — **没有检查 role
是否为 null**。NULL role 的会话本来该被 layout 拦截走，但万一 layout 升级
旁路漏过去（resolveSessionContext 的「升级失败 unset」分支后），用户看到
的会是侧边栏出现「我的评论 / 个人信息」但点开会 401。filter 的语义应该是
`hasAtLeast(role, item.minRole)`，与 `requireRole` 同源；我现在写的是手写
三段树。逻辑能跑，**但和守卫不复用同一套，将来加 `editor / contributor`
中间角色会两处分别改**。

---

## 二、本可以修但留下的旧坑

### O1. Password reset 不撤销其他 session（高危）

`wp-login.tsx` 的 reset 流程：
`consumeToken → updateUserById(password) → establishLoginSession`。
**没有 `revokeAllSessionsOfUser(userId)`**。攻击场景：

1. 攻击者拿到受害者 cookie。
2. 受害者发现异常 → 「忘记密码」改密码。
3. 受害者认为自己安全了，但 **攻击者的旧 cookie 仍然有效**。

Reset 是凭证恢复路径，按 OWASP 标准应该撤销所有 session 再建新的。计划没
提，我也没修。**这是个真正的安全 bug**，比账户自助改密码遗漏 except
还严重。

**正确做法**：在 `establishLoginSession` 之前调
`revokeAllSessionsOfUser(BigInt(result.userId))`（不传 except，因为旧
session 都该被踢）。

### O2. Reset / accept-invite 完全没有 CSRF 校验

`wp-login.tsx:115-139` 这条分支直接读 `formData.get('reset_token')` →
`consumeToken` → 改密码 → 登录。**没调 `validateRequestCsrf`**。

普通 reset 链接是邮件里点开，URL 含 token，攻击者难以拿到。但：

- 用户在公共论坛误贴 reset 链接 → 任何第三方页面可构造表单触发整个流程。
- accept-invite 的 token TTL 是 **7 天**，攻击窗口宽。

`signInWithSession` / `signUpInitialAdminWithSession` /
`seedInstallSettingsWithSession` 三条都走 `csrfFailure()`，唯独
reset/accept-invite 跳过。这是原 PR 的遗漏，我也没补。

### O3. `admin.inviteAuthor` DB-先-邮件-后，无回滚（操作性 bug）

```ts
const [user] = await insertAuthor(payload.name, payload.email)
if (!user) throw new ActionFailure(500, '创建作者账户失败。')
const { token } = await issueSetupToken(Number(user.id))
const link = `${origin}/wp-login.php?action=accept-invite&token=${token}`
await sendAuthorInvite(user, link, inviter)
```

如果 `sendAuthorInvite` 失败（SMTP 故障 / 配额耗尽 / 临时 unconfigured）：

- author 行已经写库。
- 邀请人看到 500 错误，不知道账号实际上已建。
- 重试 → 409「邮箱已被注册」，**死锁**。需要管理员去 DB 删行或直接走
  sendPasswordReset 凑活。

**正确做法**（至少二选一）：

- 拆成两步：先创建 row（明确 emailVerified=false）+ 状态字段
  「pending_invite」，UI 显示「待激活」并提供「重发邀请邮件」按钮，邮件
  失败不影响 row 状态；
- 或把 insert 包进 try / catch，邮件失败时 `softDeleteUser` 回滚。

我的实现没动这块。

### O4. `admin.sendPasswordReset` 缺速率限制

`admin.inviteAuthor` 有 `tryInviteRateLimit(ctx.clientAddress)`。
`admin.sendPasswordReset` 没有任何节流 — 一个 admin（或被劫持的 admin
cookie）可以无限循环发重置邮件，把 SMTP 配额烧光、把目标邮箱炸垃圾箱。

- 既存在 admin 接口，rate-limit 本身没必要按 IP 锁（admin 是少数信任主体）；
- 但 **应该按 target userId 节流**：同一 target 60 秒内只能触发一次重置。
  `@/server/rate-limit` 已有可复用的桶。

### O5. `admin.approveCommentDeletion` 不校验请求存在

```ts
if (payload.approve) {
  await softDeleteCommentById(id) // ← 任何 commentId 都会软删
}
```

「批准用户的删除请求」语义上要求 `deleteRequestedAt !== null`。我没加这个
guard。结果：admin 可以把这个端点当成「软删任意评论」用。它实际只在
「待审 / 已申请删除」队列里曝出来，UX 上不会出问题，**但语义不严，审计
log 也会撒谎**（`'delete request approved'` 实际是 admin 主动删的）。

应该：先 `findCommentById(id)`，断言 `deleteRequestedAt !== null`，否则
409「该评论没有删除申请」。

### O6. `Number(user.id)` 在 token 流程里有 bigint 精度风险

四个调用点：

- `admin.sendPasswordReset.ts:25`、`admin.inviteAuthor.ts:35`、
  `wp-login.tsx:95,105`。
- `verification-tokens.ts::issueResetToken(userId: number)` 内部
  `tokenId('password-reset', userId)` 拼字符串，consume 时
  `Number.parseInt(userIdStr, 10)`。

`bigserial` 的范围远超 `Number.MAX_SAFE_INTEGER` (2^53)。当前用户数远没
那么多，**今天不会爆**。但作为 RBAC 子系统的基础设施，把 bigint 收窄到
number 是设计气味。

**正确做法**：`issueResetToken(userId: bigint)`、`tokenId` 用
`userId.toString()`、consume 时 `BigInt(userIdStr)`、返回
`{ userId: bigint }`。整条链路保持 bigint。

### O7. `listMyComments` 7 天软删窗口 vs `countMyComments` 严格未删 — 不一致

```ts
// listMyComments:
or(isNull(comment.deletedAt), gte(comment.deletedAt, now - 7d))

// countMyComments:
isNull(comment.deletedAt)
```

`/wp-admin/my/comments` 的「总计」数会比 list 实际返回的少。
`hasMore = offset + comments.length < counts.total` 因此也会算错，触发奇怪
的分页 bug。

**正确做法**：两者用同一条件（建议：count 也加 7 天窗口，并把这条窗口
逻辑抽成一个常量 `MY_COMMENTS_SOFT_DELETE_GRACE_MS`）。或者干脆不显示
软删评论，UI 加「已删除」徽标的逻辑就全删。

### O8. `MyProfileForm` 提交「清空 link」会被 Zod 拒

```ts
const payload: Record<string, string | null> = { name, link: link || '' }
```

Schema: `link: z.url().max(255).optional().nullable()`。空字符串 `''`
不是合法 URL — Zod 会返回「Invalid URL」400。用户想清空个人主页时报错。

**正确做法**：`link: link.trim() === '' ? null : link.trim()`。

### O9. `MyProfileForm` 保存成功后不 revalidate

`useFetcherResult(profileFetcher, { onSuccess: () => setProfileMessage('已保存。') })`。
loader 的 `initial` 永远是首次进入的快照。用户改完名字保存后，再切到
「我的评论」回来，header 仍显示旧名字。`MyCommentsList` 的
`useRevalidator().revalidate()` 模式我没复用到这里。

---

## 三、设计哲学层面的问题

### D1. 「Role 在 session vs DB」一致性策略 — 没做出真正的选择

当前实现：login 时把 DB.role 写进 session，之后所有 RBAC 决策读
session.role，**不再回 DB 校验**。这是个明确的设计选择，但我没在代码里
写出来这个不变量，也没保护它：

- `admin.updateUserRole` 改完 role 之后调 `revokeAllSessionsOfUser` →
  强制重登 → 新 session 拿新 role。**这条路径是正确的**。
- 但 `admin.softDeleteUser` 之后呢？目标用户的 session 不会被撤销。一个
  被「软删」的 admin 仍能用旧 cookie 操作系统直到 cookie 30 天过期。这是
  silent privilege retention。

**应该**：所有改变 role / 删除用户 / 禁言（一些场景）的 mutation 都触发
revokeAll。要么在 admin 路由层 case-by-case 加，要么干脆把它做成「角色读取
一律穿透到 DB」（短缓存即可），换更强的实时性。我没做这个取舍。

### D2. 守卫语义没有形式化

我留了三类东西：

1. `hasAtLeast(role, min)` — 层级谓词
2. `requireRole(ctx, min)` — 抛错门面
3. `canEditPost / canEditImage / canEditMusic / canManageComment` — 行级谓词

`canEdit*` 都返回 `admin OR (authorId === viewer.userId)`，行为完全一致。
我把它们写成了 **四个并列函数** 而不是一个工厂：

```ts
// 我的写法 — 4 个几乎相同的函数
canEditPost / canEditImage / canEditMusic / canManageComment

// 更专业的写法 — 一个工厂
function canEditOwned<T>(viewer: ViewerContext, row: T, ownerField: keyof T): boolean {
  if (viewer.role === 'admin') return true
  const owner = row[ownerField]
  return typeof owner === 'bigint' && owner.toString() === viewer.userId
}
```

更要紧的是：我把「应当严格本人」（own-routes）和「admin 也行」（行级权限）
混进了同一个谓词（R1）。一个成熟的 RBAC 设计会显式区分：

```ts
isOwner(viewer, c) // 严格本人
isOwnerOrAdmin(viewer, c) // 含 admin
isOwnerOrEditor(viewer, c) // 未来的中间角色
```

### D3. `defineApiAction` 的 viewer 类型化是泛型秀技

```ts
interface RunParams<I, R extends Role | undefined> {
  viewer: R extends Role ? ViewerContext : undefined
}
```

这个条件类型在 90% 的调用点上 **毫无意义**（要么 require role，viewer
必有；要么没 require role，handler 根本不写 viewer）。当 `R = undefined`
时 `viewer` 是 `undefined`，handler 也不会去读它。条件类型的成本（类型推
导慢、报错难读、`as RunParams<I, R>['viewer']` 兜底）大于收益。

**更专业的写法**：分两个工厂。

```ts
defineApiAction({ method, input, run: ({ ctx, payload }) => ... })          // 匿名
defineGuardedApiAction({ method, input, requireRole, run: ({ ctx, payload, viewer }) => ... })  // 需角色
```

签名硬分两个，重载或工厂返回都行。每个工厂内部 viewer 是
`ViewerContext`（非空），handler 类型干净。

### D4. `establishLoginSession` 没有撤销旧 session 的选项

`establishLoginSession(session, user, request, clientAddress)` 单纯写新
session 并 sadd 进 `user_sessions:`。但「accept-invite」「reset password」
这种语义上是「凭证轮换」的操作，**应当先调用 `revokeAllSessionsOfUser`
再建立新 session**（详见 O1）。

签名应该是：

```ts
establishLoginSession(session, user, request, clientAddress, {
  revokeOtherSessions?: boolean // 默认 false；reset 时传 true
})
```

我抽了这个工具但语义不完整。

### D5. 「访客在 wp-admin 里看到 1.5 MB JS bundle」是设计债

`wp-admin.layout.tsx` 引入 `admin.css` (180 KB raw)、`AdminShell` (含
Sheet、Avatar、ThemeToggle 等)、各种 admin shadcn 组件 chunk。为了让
visitor 能改自己资料 + 看自己评论，每个 visitor 在登录后台时拉下整个
admin SPA 是浪费的。

计划里讨论过方案 Y：`/comments/mine` 走公共路由。我选了方案 X，但没在
代码里加注释解释这个取舍，也没把 `/my/*` 的 chunk 配置成可独立分割。

未来如果非 admin 用户量级起来（比如 100K 注册访客），这会变成真问题。
**不是 blocker，但应当在 README/CLAUDE.md 里写明：访客走 wp-admin 是临时
方案**。

### D6. `BlogSession` 暴露在 ctx 上是个口子

`ApiContext` 暴露 `session: BlogSession`。但有了 `viewer` 之后，handler
应该用 `viewer` 不应该用 `session`。`session` 暴露在 ctx 上是个口子，
handler 可以 `ctx.session.get('user')` 绕过 viewer 系统。

`comment.replyComment.ts:29` 那种「需要读是否 admin 用于绕过 rate-limit」
的场景没有 requireRole，所以拿不到 viewer，不得不去
`userSession(ctx.session)` 自己拿。又转回起点。

**正确做法**：把 viewer 改成「可选 viewer」一直暴露（即使无 requireRole
也注入「认证状态」），或者引入第三种「opt-in 但允许匿名」的标志。

---

## 四、迁移与 schema 层

### M1. 拆两步迁移其实是 **纯装饰**

`20260513230909_add_user_role_and_backfill` 和 `20260514000000_drop_user_is_admin`
在同一个 release 一起 ship，drizzle 在 boot 时按字典序一口气跑完。两步
之间没有「应用代码部署」窗口。这违背了拆步迁移的初衷——**真正的两步**
需要：

- v1.0：只 add column + 回填，代码仍写 `is_admin`。
- v1.1：代码切到 role，**这个版本部署**。
- v1.2：drop column。

但项目是单仓 + 滚动部署，做不出真正的两步。我做的拆分是 cargo-cult，
应该合回一个 migration。或者注释清楚「这两步必须一起跑，拆开只是为了
将来可读」。

### M2. `idx_user_role`：schema 与 migration 写法不一致

- SQL：`CREATE INDEX ... ON "user"("role") WHERE "role" IS NOT NULL`
  （partial index）。
- Schema：`index('idx_user_role').on(table.role)`（full index）。

下一次 `drizzle-kit generate` 检测到差异，会生成一条「修正」migration
删掉 partial 重建 full（或反过来），把 partial 优化丢掉。**应该让
schema 也用 partial**：

```ts
index('idx_user_role')
  .on(table.role)
  .where(sql`role IS NOT NULL`)
```

### M3. `user.role` 没有 CHECK 约束

`varchar('role', { length: 16 }).$type<'admin' | 'author' | 'visitor'>()`
— `$type` 只是 TS 类型，DB 接受任何 16 字符以内字符串。运维直连 DB
`UPDATE user SET role = 'editor'`，类型系统不会哭，但
`ROLE_LEVELS[role]` 会返回 undefined → `hasAtLeast` 永远 false。**应当**：

```sql
ALTER TABLE "user" ADD CONSTRAINT role_check
  CHECK (role IS NULL OR role IN ('admin', 'author', 'visitor'));
```

Drizzle 0.34+ 支持 `varchar(...).check(sql\`role IN ('admin', ...)\`)`. 或者
用 pg ENUM：

```ts
export const userRole = pgEnum('user_role', ['admin', 'author', 'visitor'])
// then:
role: userRole('role')
```

后者更专业，但 migration 要 `CREATE TYPE`，且 enum 增删值都需要 migration。
值得用。

### M4. `tokenId` 用冒号分隔但没 escape

```ts
function tokenId(purpose: string, userId: number): string {
  return `${purpose}:${userId}`
}
```

purpose 是硬编码字符串（`'password-reset'` / `'author-invite'`），目前
不会冲突。但如果未来加一个 `'reset:invite'` 这种含冒号的 purpose，
`split(':')` 解析就会把它拆错。

更稳的设计：把 purpose 和 userId 存成 **两列**（identifier 留作通用 join
key 给其他场景；新增 `purpose` 列和外键 `user_id`）。当前的 `identifier`
字符串拼接是 better-auth 那一套 schema 的遗留约定，但用得很别扭。

---

## 五、其他细枝末节

| #   | 问题                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `resolveSessionContext` 升级失败分支 `session.unset('user')` — 把用户踢出。但「升级失败」可能只是临时 DB 抖动，应当 retry/降级而不是删 session。                                                                                                                                                                                                                                          |
| F2  | `MyCommentsList.tsx` 的 `CommentRow` 每个评论独立持有两个 useFetcher。一页 100 条评论就是 200 个 fetcher，React Router 内部对每个独立追踪状态。**应该**：单个父级 fetcher，通过 commentId 路由结果到对应 row。                                                                                                                                                                            |
| F3  | `wp-admin.welcome.tsx:39` 中 role label 三元嵌套。`AdminShell` 里没用 label，`MyProfileForm.tsx:28` 又定义了一份 `ROLE_LABEL`。三处独立。应抽到 `@/shared/users` 或 `@/shared/roles`。                                                                                                                                                                                                    |
| F4  | `BlogSessionData` 里 `user?: SessionUser` 用 `?` 而 `SessionUser` 自己 `role: Role` 必填。**有 user 就一定有 role** — 这个不变量正好是 PR 1 想强制的，但只在 type 层强制了，没在运行时 fail-fast — `establishLoginSession` 抛错的兜底是好的。                                                                                                                                             |
| F5  | `MyProfileForm` 头一个表单收 `payload: Record<string, string \| null>` 时把 `name` 和 `link` 当字符串提交，但 schema 的 `link: z.url().nullable()` 收到字符串 `''` 就 400（O8）。                                                                                                                                                                                                         |
| F6  | `csrf` 字段名是 industry-standard 选择，但我没把它写进 schema 注释或 form 注释。后人换 `_token` / `csrfToken` 又会撕掉重写。**应该**在 schema.ts 顶部一行注释固化「我们用 `csrf` 作为 CSRF 字段名」。                                                                                                                                                                                     |
| F7  | `revokeAllSessionsOfUser(userId, exceptSessionId?)` 的实现里 `pipeline.del(...)` + `pipeline.srem(...)` 是 N×2 个命令。对 100 个 session 来说还好，但 **没必要逐个 `srem`** — 整个 set 后面也没人在意残留，set 自然过期。或者更稳：直接 `del setKey`。                                                                                                                                    |
| F8  | `verification.identifier` 没 UNIQUE，`issueToken` 的「先 delete 再 insert」依赖事务隔离级别。在 READ COMMITTED 下两个并发请求都看到 0 行可删 → 都 insert → 两个 token 都活着。应当：UNIQUE(identifier) + `ON CONFLICT (identifier) DO UPDATE`。                                                                                                                                           |
| F9  | `setUserMuted` 拒绝禁言 admin 的判定（`server/db/query/user.ts`）现在是 `or(eq(role,'author'), eq(role,'visitor'), isNull(role))`。后续加 `editor` 角色会忘掉。应改成 `ne(user.role, 'admin')` — 反向断言，新角色自动包含。                                                                                                                                                               |
| F10 | `comment.edit.ts` 我把 `isAdmin(session)` 改成 `userSession(ctx.session)?.role === 'admin'` — 但 `defineApiAction` 给这个端点根本没 `requireRole`，所以可以无登录进入。逻辑「非 admin 走 token-edit 验证」OK，但端点级别没区分匿名 / 已登录的 visitor — **已登录的 visitor 没有 token 时不能编辑自己的评论**。这又是 own-routes 没复用、和 `comment.updateOwn` 平行了一套权限路径的体现。 |
| F11 | `admin.softDeleteUser` 不阻止 admin 被删（甚至自杀）。`updateUserRole` 加了「不能降级唯一 admin」「不能改自己」，但 softDelete 没加对称保护。                                                                                                                                                                                                                                             |
| F12 | `inviteAuthor` 的邮件链接不带 `Bcc: 邀请人`。审计追踪不便。                                                                                                                                                                                                                                                                                                                               |
| F13 | 我加的所有 `getLogger('audit.user')` / `'audit.comment'` 都用 `log.info`，进 stdout 即丢。审计 log 应该有独立的持久化（DB 表或专门 logger sink）。PR 计划的「不在本次范围」里有承认。当前实现是占位，**给人一种「已做审计」的虚假安全感** — 这点应当用注释明确。                                                                                                                          |

---

## 六、对计划本身的反思

### 计划过于关注「能跑」，不够关注「正确」

计划里写「确保功能跑通」的优先级最高，所以我做到了：tests/build/check
全绿，端到端流程能走完。**但 RBAC 是安全子系统**，「能跑」是最低标准。
我应该自己加一个清单：

- 每个 mutation：CSRF 校验过没？rate-limit 过没？audit log 落了没？revoke
  触发了没？错误处理回滚干净没？
- 每个角色 vs 资源：guard、UI 显示、API 端点 三层全检过没？
- 每个 role transition（升级 / 降级 / 删除 / 软删）：旧 session 都收回了
  没？

我列了表但只检查了一半。Reset 不撤 session、inviteAuthor 不回滚、
approveCommentDeletion 不校验状态、softDeleteUser 不保护 admin — 这些都是
「能跑但不正确」的典型。

### 我把 sed 当工具用错了地方

PR 1.3 那次 `requireAdmin → requireRole` 的全仓替换我用了 sed + perl —
**机械替换** RBAC 守卫是危险的。每个调用点应该被人脑过一遍，看「这里
真的是 admin only 吗？author 也行吗？」。我快了 30 分钟，但留下了
`wp-admin.pages.tsx` 全部 `admin`-only 这种问题 — 我没评估，直接 sed
过去保留了原状。

### 我没让 plan 自己跟着代码进化

发现 R1 / O1 / O5 这类问题时本该回去更新计划文件，明确说「Reset flow
must revoke sessions」「Own-routes use isCommentOwner not canManageComment」。
我没做，所以下一个 reviewer 看着 plan 以为一切都按计划落地了，而实际上
plan 里没说的坑还在。

---

## 七、修复清单（按严重度）

**🔴 Blocker**：

1. `cancelDeleteOwn` 的守卫和 DB 操作脱节 → 还原 own-routes 守卫为严格
   isOwner，**或** 让 `cancelDeleteOwn` 的 DB 操作 admin-bypass。
2. Reset / accept-invite 不撤销其他 session（O1）。
3. Reset / accept-invite 无 CSRF 校验（O2）。
4. `wp-admin.posts/images/musics/tags` 等无路由级守卫，layout 降级后泄露
   给 visitor（R2）。

**🟠 高优**：

5. `admin.inviteAuthor` 邮件失败不回滚（O3）。
6. `admin.sendPasswordReset` 无 target 速率限制（O4）。
7. `admin.approveCommentDeletion` 不校验请求存在（O5）。
8. `listMyComments` 与 `countMyComments` 软删窗口不一致（O7）。
9. `MyProfileForm` 清空 link 触发 400（O8）。

**🟡 设计**：

10. `requireRole` 改为断言 user 参数本身，去掉所有 `user!.id` 非空断言
    （R4）。
11. 拆 `defineApiAction` 与 `defineGuardedApiAction`，去掉条件类型（D3）。
12. `admin.softDeleteUser` 加对称保护（F11）。
13. `idx_user_role` schema 与 migration 一致（M2），加 `role` CHECK 或
    pg enum（M3）。
14. 拆 own-routes 谓词为 `isCommentOwner`，与 `canManageComment` 分家
    （D2 / R1）。

**🟢 清理**：

15. `Number(user.id)` → `bigint`（O6）。
16. 合并 / 删除 `ErrorMessages.NOT_ADMIN`（R3）。
17. AdminShell filter 用 `hasAtLeast` 与守卫复用（R5）。
18. 抽 `ROLE_LABEL` 到 shared（F3）。
19. role transition 后统一 revoke（D1）。

---

## 总结

我交付了一份 **能编译、能跑测试、能 build** 的工作，但用 RBAC 的标准
重新审视，发现：

- **3 处真正的 regression**（R1 cancelDeleteOwn 坏掉、R2 layout 守卫缺口、
  R3 错误消息退化）；
- **2 处高危安全 issue** 我有机会修但放过去了（O1 reset 不撤 session、
  O2 reset 无 CSRF）；
- **多处设计气味**（D1-D6）显示我用了「形似」的抽象（`canManageComment`
  当 own-router 守卫、`defineApiAction` 的条件类型 viewer）而没去想抽象
  本身的语义是否对；
- **Migration 拆分是 cargo-cult**，schema/migration 不一致已经在等下一个
  `drizzle-kit generate` 撞上。

如果让我重新做一遍，**我会把 Code Review checklist 写进 plan**，每个
mutation 端点都过 CSRF / rate-limit / revoke / audit / rollback 五栏，
而不是只查「能不能跑通」。
