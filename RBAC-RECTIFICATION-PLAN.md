# RBAC 自审整改 5-Phase 计划

> 本计划对应 [`RBAC-REVIEW.md`](./RBAC-REVIEW.md) 评审报告，逐条覆盖其
> R / O / D / M / F 30+ 项。**保留备用**：可整段执行，也可按 Phase 挑选。
> 历史关联：migration 重置（M1+部分 M2）已另行通过 `feature/rbac-model`
> 的方案先行处理。

## Context

`feature/tailwind-enhancement` 分支上完成的 RBAC 重构（PR 0-4）通过了
`vp check / vp test run / vp build` 全套验证，但在严苛的代码评审下暴露出 30+
项问题。

**用户决策（已确认）：**

- **Scope**：全部四档 + 零散全做。单次大 PR。
- **`user.role` DB 类型**：pg ENUM (`CREATE TYPE user_role`)。
- **`defineApiAction`**：拆成 `defineApiAction`（匿名）+ `defineGuardedApiAction`
  （需角色，注入 viewer）。
- **Audit log**：现状保留 stdout，代码里加注释明确占位状态（DB 表落地为后续单独 PR）。
- **`/my/*` 访客 UX**：移到 public layout，wp-admin layout 恢复 `author` 门槛。

## 总体策略：5 Phase

| Phase       | 主题                             | 评审条目                          | 阻塞依赖                                   |
| ----------- | -------------------------------- | --------------------------------- | ------------------------------------------ |
| **Phase 1** | 安全 + 守卫硬伤                  | R1 R2 O1 O2 O3 O4 O5 O7 O8 O9 F11 | 无（最高优先）                             |
| **Phase 2** | Schema / Migration / Role 一致性 | M3 M4 D1 R3 F8 F9                 | Phase 1；migration 重置已先处理 M1+部分 M2 |
| **Phase 3** | 架构重设计                       | D2 D3 D4 D6 R4 R5 F7              | Phase 1                                    |
| **Phase 4** | `/my/*` 路由迁移到公共 layout    | D5 + 反向收紧 R2                  | Phase 1.3                                  |
| **Phase 5** | 零散清理                         | F1 F2 F3 F6 F10 F12 F13 O6        | 无                                         |

## Phase 1 — 安全 + 守卫硬伤（最高优先）

### 1.1 拆分 own-routes 谓词，修复 R1（cancelDeleteOwn 坏掉）

`canManageComment` 含 admin bypass，但 own-routes 语义要求严格本人。当前
`cancelDeleteOwn` 通过守卫后 DB 操作仍要求 `deleteRequestedBy = viewer.userId`，
admin 进入会 409。

- 在 `src/server/auth/rbac.ts` 新增 `isCommentOwner(viewer, c)`（不含 admin bypass）。
- 三个 own-routes 把 `canManageComment` 改为 `isCommentOwner`：
  `comment.requestDeleteOwn.ts` / `cancelDeleteOwn.ts` / `updateOwn.ts`。
- 测试新增 admin-on-others-comment 应该被拒为 404。

### 1.2 Reset / accept-invite 加 CSRF + 撤销其他 session（O1 + O2，高危）

- `wp-login.tsx` reset/accept-invite 分支开头调
  `validateRequestCsrf(request, formFieldString(formData, 'csrf'))`，失败 403。
- `consumeToken` 成功后、`establishLoginSession` 之前加
  `await revokeAllSessionsOfUser(BigInt(result.userId))`（不传 except）。
- 在 `wp-login.tsx` 顶部注释固化「reset 必撤所有 session」不变量。
- 测试：reset 提交无 CSRF 返回 403；reset 成功后旧 session id 不再在
  `user_sessions:<id>` 集合里。

### 1.3 wp-admin 子路由补 author / admin 守卫（R2）

给以下路由 loader 加 `requireRole(ctx, 'author')`：

- `wp-admin.posts.tsx`、`wp-admin.posts.new.tsx`、`wp-admin.posts.edit.tsx`
- `wp-admin.images.tsx`、`wp-admin.musics.tsx`、`wp-admin.tags.tsx`

最小 loader：

```ts
export async function loader({ request, context }: Route.LoaderArgs) {
  requireRole(getRouteRequestContext({ request, context }), 'author')
  return null
}
```

### 1.4 `admin.inviteAuthor` 邮件失败回滚（O3）

`src/routes/api/actions/admin.inviteAuthor.ts`：邮件 send 之外的步骤包进 try。
`sendAuthorInvite` 失败时：

```ts
await softDeleteUserById(user.id)
await revokeTokensFor(Number(user.id), 'author-invite')
throw new ActionFailure(502, '邮件发送失败，已回滚账户创建。')
```

audit log 区分 success / rollback。

### 1.5 `admin.sendPasswordReset` 按 target 节流（O4）

- `@/server/rate-limit` 新增 `tryPasswordResetByTargetRateLimit(targetUserId)`，
  桶 key `pwreset:target:<id>`，60 秒 1 次。
- `tests/_helpers/blog-settings.ts::TEST_BLOG_SETTINGS_BUNDLE.rateLimits` 补
  `passwordResetTarget` 桶。

### 1.6 `admin.approveCommentDeletion` 校验请求存在（O5）

approve 分支前 `findCommentWithUserById(id)`，断言
`c.deleteRequestedAt !== null`，否则 409。

### 1.7 `listMyComments` 与 `countMyComments` 软删窗口一致化（O7）

`src/server/db/query/comment.ts` 抽常量：

```ts
const MY_COMMENTS_SOFT_DELETE_GRACE_MS = 7 * 24 * 60 * 60 * 1000
function mineVisibleClause(userId: bigint) {
  return and(
    eq(comment.userId, userId),
    or(isNull(comment.deletedAt), gte(comment.deletedAt, new Date(Date.now() - MY_COMMENTS_SOFT_DELETE_GRACE_MS))),
  )
}
```

list / count 共用。pending / deleteRequested 聚合也加 visibility 过滤。

### 1.8 `MyProfileForm` 清空 link 转 null（O8）+ revalidate（O9）

```ts
const trimmedLink = link.trim()
const payload = {
  name,
  link: trimmedLink === '' ? null : trimmedLink,
  ...(canSetBadge ? { badgeName: badgeName || null, badgeColor: badgeColor || null } : {}),
}
```

引入 `useRevalidator` 并在 `onSuccess` 里 `void revalidator.revalidate()`。

### 1.9 `admin.softDeleteUser` 对称保护（F11）

接入 `viewer`：

- `viewer.userId === payload.userId` → 403「不能删除自己」。
- `target.role === 'admin' && countAdmins() <= 1` → 409「不能删除唯一管理员」。
- 软删后调 `revokeAllSessionsOfUser(targetId)`。
- audit log。

## Phase 2 — Schema / Migration / Role 一致性

> **注意**：migration 重置已先做了 M1（合并 migration）和 M2 的一部分。Phase 2 在此基础上继续。

### 2.1 `user.role` 改为 pg ENUM（M3）

```ts
// src/server/db/schema.ts
export const userRoleEnum = pgEnum('user_role', ['admin', 'author', 'visitor'])
// user 表：
role: userRoleEnum('role'),
```

新增 migration（在 init_schema 之后）：

```sql
CREATE TYPE "user_role" AS ENUM ('admin', 'author', 'visitor');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";
```

### 2.2 `verification` 表 — 拆 `purpose` 与 `user_id` 两列（M4 + F8）

```sql
ALTER TABLE "verification" ADD COLUMN "purpose" varchar(32);
ALTER TABLE "verification" ADD COLUMN "user_id" bigint;
UPDATE "verification"
  SET "purpose" = split_part("identifier", ':', 1),
      "user_id" = split_part("identifier", ':', 2)::bigint
  WHERE "identifier" LIKE '%:%';
ALTER TABLE "verification" ALTER COLUMN "purpose" SET NOT NULL;
ALTER TABLE "verification" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "verification" DROP COLUMN "identifier";
CREATE UNIQUE INDEX "uq_verification_purpose_user" ON "verification"("purpose", "user_id");
```

`verification-tokens.ts`：

- `issueToken(userId: bigint, purpose: string, ttlMs: number)` 用
  `ON CONFLICT (purpose, user_id) DO UPDATE`。
- `peekToken` / `consumeToken` 内部 `validatedTokenRow` 不再 split，直接读
  `purpose` 和 `user_id` 列。
- 返回 `{ userId: bigint }`。

### 2.3 `Number(user.id) → bigint` 全链路（O6）

- `verification-tokens.ts::issueResetToken(userId: bigint)`、`issueSetupToken(userId: bigint)`。
- 调用点：`wp-login.tsx:95/105`、`admin.sendPasswordReset.ts:25`、
  `admin.inviteAuthor.ts:35` — 删 `Number(...)`，直接传 `user.id`。
- `consumeToken / peekToken` 返回 `{ userId: bigint }`。

### 2.4 Role transition 后统一撤销 session（D1）

- Phase 1.9 已给 `softDeleteUser` 加了 revoke。
- `setUserMuted`：禁言不影响 session，无需撤销（当前 UI 已禁掉对 admin 禁言）。
- `restoreUser`：恢复后旧 session 已在删除时撤销，无需再次。

### 2.5 删除 / 合并 `ErrorMessages.NOT_ADMIN`（R3）

- 删除 `NOT_ADMIN` 字段。
- `FORBIDDEN` 文案改为「权限不足，需要更高角色。」。
- 全仓搜 `ErrorMessages.NOT_ADMIN` 改成 `FORBIDDEN`。

### 2.6 `setUserMuted` 反向断言（F9）

```ts
.where(and(eq(user.id, id), ne(user.role, 'admin')))
```

## Phase 3 — 架构重设计

### 3.1 `requireRole` 改为断言 user 参数本身（R4）

```ts
export function requireUserRole(user: SessionUser | undefined, min: Role): asserts user is SessionUser {
  if (!user || !hasAtLeast(user.role, min)) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }
}
```

保留 `requireRole(ctx, min)` 门面给路由 loader 用。`defineApiAction` 与
`admin.uploadImage` 改用 `requireUserRole`，去掉 `user!.id` / `user!.role` 非空断言。

### 3.2 拆 `defineApiAction` / `defineGuardedApiAction`（D3）

- `defineApiAction<I, O>({ method, input, run: ({ ctx, payload }) => ... })`
  — 匿名 / opt-in 鉴权。
- `defineGuardedApiAction<I, O>({ method, input, requireRole, run })`
  — viewer 类型非空，handler 收 `{ ctx, payload, viewer }`。
- 删除 `RunParams<I, R>` 条件类型。
- 全仓库迁移：声明 `requireRole` 的全部改用 `defineGuardedApiAction`
  （~20 个 route 文件）。

### 3.3 Permission predicates 重新组织（D2）

`src/server/auth/rbac.ts`：

```ts
function ownerOf<T extends Record<string, unknown>>(field: keyof T) {
  return (viewer: ViewerContext, row: T): boolean => {
    const owner = row[field]
    return typeof owner === 'bigint' && owner.toString() === viewer.userId
  }
}
export const isPostOwner = ownerOf<{ authorId: bigint | null }>('authorId')
export const isImageOwner = ownerOf<{ uploaderId: bigint | null }>('uploaderId')
export const isMusicOwner = ownerOf<{ uploaderId: bigint | null }>('uploaderId')
export const isCommentOwner = ownerOf<{ userId: bigint }>('userId')
export function canEditPost(viewer: ViewerContext, p: { authorId: bigint | null }): boolean {
  return viewer.role === 'admin' || isPostOwner(viewer, p)
}
// ... 同样写 canEditImage / canEditMusic / canManageComment
```

### 3.4 `establishLoginSession` 加 `revokeOtherSessions` 选项（D4）

```ts
export interface EstablishLoginOptions {
  revokeOtherSessions?: boolean
}
export async function establishLoginSession(
  session: BlogSession,
  dbUser: User,
  request: Request,
  clientAddress: string,
  options: EstablishLoginOptions = {},
): Promise<void> {
  if (!dbUser.role) throw new Error('...')
  if (options.revokeOtherSessions) await revokeAllSessionsOfUser(dbUser.id)
  // ... existing write + sadd
}
```

`wp-login.tsx` reset / accept-invite 改用 `{ revokeOtherSessions: true }`
（与 Phase 1.2 联动，搬到 helper 内部）。

### 3.5 `BlogSession` ctx 暴露的文档化（D6）

`ApiContext.session` 加注释禁止 handler 直接读 user，只用于 cookie 操作。
`comment.replyComment.ts` 保留 `userSession(ctx.session)` 作为有意的 opt-in 点。

### 3.6 `AdminShell` filter 与守卫复用 `hasAtLeast`（R5）

新增 `@/shared/roles.ts`，把 `ROLE_LEVELS` / `Role` / `hasAtLeast` 抽到
isomorphic 层。server 与 UI 各自 import。

### 3.7 `revokeAllSessionsOfUser` 简化（F7）

```ts
export async function revokeAllSessionsOfUser(userId: bigint, exceptSessionId?: string): Promise<void> {
  const redis = redisInstance()
  const setKey = `user_sessions:${userId}`
  const sessionIds = await redis.smembers(setKey)
  const targets = exceptSessionId ? sessionIds.filter((sid) => sid !== exceptSessionId) : sessionIds
  if (targets.length === 0) return
  const pipeline = redis.pipeline()
  for (const sid of targets) pipeline.del(`session:${sid}`)
  if (!exceptSessionId) pipeline.del(setKey)
  else for (const sid of targets) pipeline.srem(setKey, sid)
  await pipeline.exec()
}
```

## Phase 4 — `/my/*` 路由迁移到 public layout（D5）

### 4.1 `routes.ts` 重排

`/wp-admin/my/comments` 和 `/wp-admin/my/profile` 从 wp-admin layout 下挪出，
改路径到 `/my/comments` 和 `/my/profile`，放进 public layout。

文件移动：

- `src/routes/wp-admin.my.comments.tsx` → `src/routes/my.comments.tsx`
- `src/routes/wp-admin.my.profile.tsx` → `src/routes/my.profile.tsx`

各自加 `requireRole(ctx, 'visitor')` loader。

### 4.2 wp-admin layout 恢复 `author` 门槛

```ts
if (!hasAtLeast(role, 'author')) {
  throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
}
```

### 4.3 公共 chrome 加 user menu

新增 `src/ui/public/chrome/UserMenu.tsx`，复用 shadcn `DropdownMenu`：

- 「我的评论」→ `/my/comments`
- 「个人信息」→ `/my/profile`
- 「后台管理」→ `/wp-admin/welcome`（仅 admin / author）
- 「退出登录」→ `/wp-login.php?action=logout`

`root.tsx` loader 返回 `currentUser: { id, name, role } | null`。
`PublicChrome.tsx` props 透传。

### 4.4 AdminShell 删 `/my/*` 入口

`AdminShell.tsx` `NAV` 数组里删除最后两条。

### 4.5 30x 兼容

旧 URL `/wp-admin/my/comments` 与 `/wp-admin/my/profile` 保留为 30x stub。

## Phase 5 — 零散清理

| #   | 操作                                                                |
| --- | ------------------------------------------------------------------- |
| 5.1 | 抽 `roleLabel(role)` 到 `@/shared/roles.ts`（F3）。                 |
| 5.2 | `MyCommentsList` 提升 fetcher 到父级，删 per-row state（F2）。      |
| 5.3 | `resolveSessionContext` 升级失败兜底：DB 抖动时保留 session（F1）。 |
| 5.4 | CSRF 字段名固化注释（F6）。                                         |
| 5.5 | `inviteAuthor` 邮件 Bcc 邀请人（F12）。                             |
| 5.6 | Audit log 占位注释明确标注「后续 PR 落 DB 表」（F13）。             |
| 5.7 | `comment.edit` 已登录访客无 token 路径放行（F10）。                 |
| 5.8 | `BlogSessionData.user` 反不变量注释（F4）。                         |
| 5.9 | 新建 `docs/rbac-mutation-checklist.md` 或写进 `CLAUDE.md`：CSRF /   |
|     | rate-limit / audit / revoke / rollback 5 栏清单。                   |

## 推进节奏建议

- **Day 1**：Phase 1（10 项血腥修复）。手动验证 reset 安全。
- **Day 2**：Phase 2（迁移 + role 一致性）。需要 DB reset 测试两轮。
- **Day 3**：Phase 3（架构）。批量改 ~20 个 route 文件。
- **Day 4**：Phase 4（`/my/*` 迁移）。新增 UserMenu UI。
- **Day 5**：Phase 5 + e2e smoke。

总计约 5 天单人工时，1500-2000 行变更。建议**至少 Phase 1 单独切 PR**先合入，
缓解线上安全风险。

## 不在本次范围

- `audit_log` 表与 admin UI（F13 持续作为后续 PR）。
- author/visitor 可写 `/wp-admin/pages` 的权限粒度。
- 引入 `editor` / `contributor` 中间角色。
- `/wp-admin` URL 重命名（AGENTS.md「Preserve public URLs」约束）。

## 参考

- [`RBAC-REVIEW.md`](./RBAC-REVIEW.md) — 完整评审报告，本计划逐条对应其 R / O / D / M / F 编号。
