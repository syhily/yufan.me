# 自研轻量 RBAC 设计文档

## Context

项目原本计划接入 Better Auth 引入 `admin / author / visitor` 三级角色，并通过 Better Auth 的 `createUser` + `sendResetPassword` 完成「邀请作者」「访客评论审核后建账户」等流程（详见 `~/.kimi/plans/ghost-rider-hercules-riri-williams.md`）。评估后认为：

- Better Auth 的 `secondaryStorage`、`endpoint hook`、`additionalFields`、CLI 生成 schema 等都为高阶场景准备；本项目实际只需要「角色 + 拥有权 + 邮件链接重置密码」三件事。
- 现有自研 session（Redis `__session` + 5min CSRF token + bcrypt）已经稳定运行，Better Auth 的 cookie/session 切换还会把所有已登录用户挤掉。
- Better Auth 引入了 4 张新表（`auth/account/session/verification`）和一套与现有 `user` 表并行的「双账户体系」，复杂度远大于业务需要。

**目标**：保留现有 bcrypt + Redis `__session` 框架，在 `user` 表上加一个 `role` 列，把今天的二元 `isAdmin` 升级成三级 RBAC，并补齐自助密码重置与作者邀请所需的 token 流程。所有改动都向后兼容现有 50+ admin API 与评论流程，迁移阶段不踢人下线。

## 非目标

- 不引入任何外部 auth 库（Better Auth / NextAuth / Lucia / ...）。
- 不做多角色（一人一角色）、不做权限矩阵（角色直接映射能力）、不做组织/团队层级。
- 不做 OAuth / 第三方登录、不做 2FA、不做 email 验证（点击重置邮件链接即为隐式验证）。
- 不引入「公开注册页」。

---

## 1. 角色模型

```
admin       ─── 完整管理权，唯一能管理用户/角色/设置
author      ─── 自己 author_id 名下的 posts；read-only 用 categories/images/music；
                tags 可新增、可删除「无 post 引用」的；
                images/music 可上传，只能改/删自己 uploader_id 名下的
visitor     ─── 登录后能看自己的所有评论、编辑（触发重审）、申请删除（admin 审批）
anonymous   ─── 现状不变；评论保留 user 表无密码记录
```

一人**只**有一个角色，存在 `user.role: 'admin' | 'author' | 'visitor' | null`。
`role IS NULL` ↔ 匿名评论者占位记录（沿用 `insertCommentUser` 现有路径），无登录能力。

角色边界严格单向放大：`admin ⊇ author ⊇ visitor`。所有 `requireRole(...)` 检查通过「枚举包含关系」实现，避免在调用点写 `role === 'admin' || role === 'author'` 字面量。

---

## 2. Schema 变更（最小集）

### `user` 表

```sql
ALTER TABLE "user" ADD COLUMN "role" varchar(16);
-- 回填
UPDATE "user" SET "role" = 'admin' WHERE "is_admin" = true;
-- 同迁移内删除 is_admin，避免双源同步问题
ALTER TABLE "user" DROP COLUMN "is_admin";
CREATE INDEX idx_user_role ON "user"(role) WHERE role IS NOT NULL;
```

> 决策：**同一次迁移删 `is_admin`**。保留双源会引入「改了 role 没改 is_admin」的 bug 面；项目还没有外部数据导入需要 `is_admin` 兼容。

### `comment` 表（新增删除申请字段）

```sql
ALTER TABLE "comment" ADD COLUMN "delete_requested_at" timestamptz;
ALTER TABLE "comment" ADD COLUMN "delete_requested_by" bigint;
CREATE INDEX idx_comment_delete_requested_at ON "comment"(delete_requested_at)
  WHERE delete_requested_at IS NOT NULL;
```

`delete_requested_by` 指 `user.id`，仅用于审计（理论上 = `comment.userId`，但 admin 可代发请求时不一定）。

### `image` / `music` 表

**无 schema 变更** — `image.uploaderId`（`src/server/db/schema.ts:278`）与 `music.uploaderId`（`schema.ts:329`）已存在，只需在写入路径中开始填值，并在删/改 endpoint 加 ownership 校验。

### 密码重置 / 作者邀请 token — 用现有 `verification` 表

`src/server/db/schema.ts:152` 已经有一张 6 列 Better-Auth-风格的 `verification` 表：

```
id          text PK
identifier  text NOT NULL
value       text NOT NULL
expiresAt   timestamp NOT NULL
createdAt   timestamp NOT NULL (default now)
updatedAt   timestamp NOT NULL (default now)
```

它原本是为 Better Auth 准备的，现在直接复用。**不**新增列，**不**走 Redis，理由：

1. Redis 重启会丢 TTL，密码重置/邀请的语义不允许丢失（特别是 7d 邀请）。
2. DB 已有事务，「消费 token + 写新密码」可以在同一事务里原子完成。
3. 可被 admin 后台审计/吊销（未来要做「我发出的邀请列表」时就有数据源）。

**列语义**：

| 列 | 用法 |
|---|---|
| `id` | 一次性 token id（UUID v4），URL 里不出现 |
| `identifier` | `'<purpose>:<userId>'`，例：`'password-reset:42'`、`'author-invite:42'`。`<purpose>` 决定 TTL / 模板 / consume 后续动作 |
| `value` | URL token 的 `sha256(token)` 十六进制串。**不存明文**；URL 里那串才是明文 |
| `expiresAt` | 写入时 `now + TTL`。`password-reset` 15 min；`author-invite` 7 d |
| `createdAt` / `updatedAt` | 现成 |

URL 形态：`/wp-login.php?action=resetpassword&token=<base64url(32B)>`。

**查找**：

```sql
SELECT id, identifier, expires_at
  FROM verification
 WHERE value = $1                       -- = sha256(incoming_token)
   AND expires_at > now()
 LIMIT 1;
```

**消费**（事务内）：

```sql
BEGIN;
DELETE FROM verification WHERE id = $1 RETURNING identifier, expires_at;
-- 通过 identifier 拆出 userId、purpose
UPDATE "user" SET password = $bcrypt WHERE id = $userId;
COMMIT;
```

**签发新 token 时同时清旧的**（同 user 同 purpose 只允许一条有效 token）：

```sql
DELETE FROM verification WHERE identifier = $('purpose:userId');
INSERT INTO verification (id, identifier, value, expires_at) VALUES (...);
```

**清理过期**：用现有 `src/server/cache/` 风格的轻量后台 job，每 6 小时跑一次 `DELETE FROM verification WHERE expires_at < now() - interval '1 day'`（不立刻删，保留 1 天用于事后审计/防重放回放报错）。

**安全细节**：

- token 用 `crypto.randomBytes(32)` → `base64url`（≈43 字符）。
- 入参 token 必须先做长度/字符集白名单校验（`/^[A-Za-z0-9_-]{32,80}$/`），再去 hash 查 DB，防 SQL Injection / 长字符串攻击。
- 消费失败（已被使用、过期、不存在）都返回**同一**通用错误，不区分。
- 消费成功后立刻 `revokeAllSessionsOfUser(userId)`（防旧 session 残留）。

### 多端 session 登记（用于角色变更时强制下线）

```
user_sessions:<userId>    Redis Set，元素为 sessionId（即 cookie value）
```

`login()` 在写入 `session:<sid>` 的同时 `SADD` 到这个 Set；`logout` 时 `SREM`。
角色变更或被删号时，遍历 Set 删除所有对应 `session:<sid>`，下次请求自动掉线。
这是这次设计里唯一一个稍微非平凡的 Redis 操作；可放进 `src/server/auth/session-storage.ts` 一个新函数 `revokeAllSessionsOfUser(userId)`。

---

## 3. Session 与中间件

`SessionUser`（`src/server/auth/session-storage.ts:8`）增加一个字段：

```ts
interface SessionUser {
  id: string
  name: string
  email: string
  website: string | null
  role: 'admin' | 'author' | 'visitor'   // 新增；登录时从 user.role 写入
  // admin: boolean                       // 删除
}
```

中间件层（`src/server/middleware/session.ts`）**不再做额外 DB 查询**：role 在 login 时就写进 cookie payload。代价是「admin 给某用户改了 role 后，该用户下一次请求带的还是旧 role」，被 `revokeAllSessionsOfUser` 兜底（管理员改 role 后立即 revoke 该用户全部 session → 该用户下一次请求 session 为空 → 重登）。

`SessionContext` 收紧成：

```ts
interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  role: 'admin' | 'author' | 'visitor' | null   // 未登录 = null
}
```

`admin: boolean` 字段保留一个 alias getter（`role === 'admin'`）用于过渡期；新代码不应再读它。

---

## 4. 授权 Helpers — 单一来源

新文件 `src/server/auth/rbac.ts`：

```ts
export const ROLE_LEVELS = { visitor: 1, author: 2, admin: 3 } as const
export type Role = keyof typeof ROLE_LEVELS

export function hasAtLeast(role: Role | null | undefined, min: Role): boolean
export function requireRole(ctx: SessionContext, min: Role): asserts ctx is AuthedContext
export function requireAdmin(ctx: SessionContext): asserts ctx is AdminContext
export function requireAuthor(ctx: SessionContext): asserts ctx is AuthorContext   // author 或以上
export function canEditPost(ctx: AuthedContext, post: { authorId: bigint | null }): boolean
export function canEditImage(ctx: AuthedContext, img: { uploaderId: bigint | null }): boolean
export function canEditMusic(ctx: AuthedContext, m: { uploaderId: bigint | null }): boolean
export function canDeleteTag(ctx: AuthedContext, tag, postCount: number): boolean
export function canManageComment(ctx: AuthedContext, c: { userId: bigint }): boolean
```

- 所有权检查传 `ctx.user.id`，**绝不**接受调用方传入的 `requestedAuthorId`；防 IDOR。
- `requireXxx` 抛 `ActionFailure(403, ErrorMessages.FORBIDDEN)`，让 `runApi` 自动落 JSON。
- 替换 `requireAdminSession`（`src/server/route-helpers/api-handler.ts:149`）为 `requireAdmin`；旧名保留一个 thin alias，新代码不用。

`defineApiAction` 的 config 扩展：

```ts
{
  method,
  input?,
  requireRole?: Role,           // ★ 新；'admin' | 'author' | 'visitor'
  requireAdmin?: boolean,       // 旧；= requireRole: 'admin'，保留兼容
  run(ctx, payload),
}
```

`runApi` 内部把 `requireAdmin: true` 翻译成 `requireRole: 'admin'`，统一走一个分支。

---

## 5. 三个用户创建通道（不依赖外部库）

### 5.1 安装：第一个 admin

`src/routes/wp-admin.install.tsx` 流程不动，只在 `insertAdmin` 内部把 `isAdmin: true` 改成 `role: 'admin'`（schema 改完顺势改）。

### 5.2 Admin 邀请 author

UI：`/wp-admin/users` 新增「邀请作者」按钮 → 弹 `InviteAuthorDialog`（name + email）。

后端 `POST /api/actions/admin/inviteAuthor`：

1. 唯一性：`findUserByEmail`；存在则 409 拒绝（不偷偷升级老用户角色）。
2. **不**生成密码字段；`insertAuthor(name, email)` 写入 `password: ''`、`role: 'author'`、`emailVerified: false`、`badgeName: 'AUTHOR'`。
3. 调 `issueSetupToken(userId, email)` → 写 Redis `pwd_setup:<token>` TTL 7d。
4. 通过现有 SMTP 模板 `AuthorInvite`（新增）发链接 `${origin}/wp-login.php?action=accept-invite&token=<token>`。
5. 速率限制：每 admin 每 email 每 1 小时最多 1 封；统一用 `tryRateLimit('invite', adminId+email)`。

> 关键：作者账户**在 admin 点提交那一刻**就已经在 `user` 表存在并带 `role='author'`，但 `password=''`、登录失败；只有走完邀请链接设密码，才真正能登录。这避免了「token 失效后 admin 还得手动清理半成品账户」。

### 5.3 Visitor — 评论审核流程不变

不像原 Better Auth 计划那样在审核通过时新建账户。流程改为：

1. 匿名评论：`insertCommentUser` 继续在 user 表创建 `role=null, password=''` 的占位记录（**没有变化**）。
2. 评论审核通过：**不**自动「升级」该用户为 visitor。该用户仍然是 anonymous，不能登录。
3. **用户主动**走 `/wp-login.php?action=lostpassword` 输入 email → 判断分支：
   - email 不存在于 `user` 表 → 假装成功（防 email enumeration），不发邮件。
   - email 存在但 `role IS NULL` 且 `password=''` 且 `countApprovedCommentsByUser(uid) >= 1`（至少有一条审核过的评论）→ 升级为 `role='visitor'`、签发 `pwd_reset:<token>` TTL 15min，发「设置密码」邮件。
   - email 存在且 `role IS NOT NULL` → 正常重置流程，发「重置密码」邮件。
   - email 存在但 `countApprovedCommentsByUser(uid) === 0` → 假装成功，不发。
4. 用户点链接 → 设置密码 → 自动登录，往后即 `visitor`。

> 这么改的原因：原计划「审核通过即建账户 + 发邮件」会让没填正确邮箱的人收到莫名其妙的邮件，也会在 user 表与登录系统之间引入主动同步成本。换成「主动 opt-in」更安全、更可解释，且与「申请删除评论」的语义自洽（要先登录才能申请删除）。

### 5.4 标记 SPAM 的清理

延续原计划：评论标 SPAM 时若该 `user.role IS NULL`，且其他评论数 = 0，则一并删除 user 记录。
若 `role` 已非空（已升级 visitor 或就是 author/admin）→ **不**删 user，只删评论。

---

## 6. 密码自助：忘记/重置/邀请落地是同一套机制

三个登录页 action 全部从 `src/routes/wp-login.tsx` 进，按 query string 分支：

| URL | Loader | Action | 备注 |
|---|---|---|---|
| `/wp-login.php` | 签 CSRF，渲染登录表单 | bcrypt 校验 → login | 现状 |
| `/wp-login.php?action=lostpassword` | 签 CSRF | 见 5.3 流程；不论结果都 200 | rate limit by IP + email |
| `/wp-login.php?action=resetpassword&token=…` | 校验 token 存在；签 CSRF | 校验 token → 写新密码 → `del pwd_reset:<token>` → login（顺便清除该用户所有旧 session） | token 单次有效 |
| `/wp-login.php?action=accept-invite&token=…` | 同上，但 token namespace 是 `pwd_setup:` | 同上 | token TTL 7d；首次设密码后清除 |
| `/wp-login.php?action=logout` | logout | — | 现状 |

新文件：

- `src/server/auth/verification-tokens.ts` — 封装 `verification` 表读写：
  - `issueResetToken(userId): Promise<{ token: string; expiresAt: Date }>`
  - `issueSetupToken(userId): Promise<{ token: string; expiresAt: Date }>`
  - `consumeToken(rawToken, purpose): Promise<{ userId: number } | null>`  ← 事务内 DELETE+RETURNING
  - `revokeTokensFor(userId, purpose): Promise<void>`
  - `purgeExpired(): Promise<number>` ← 后台 job 调用
- `src/server/db/query/verification.ts` — drizzle 层薄包装。
- `src/server/email/templates/PasswordReset.tsx` + `templates/AuthorInvite.tsx`。
- `src/server/email/sender.ts` 加 `sendPasswordReset(user, link)` / `sendAuthorInvite(user, link, inviterName)`。

**安全细节**：

- token 用 `crypto.randomBytes(32)` + base64url，避免可预测。
- 消费 token 时使用 `EVAL` 脚本（GET + DEL 原子）防止并发双重重置。
- 重置成功 → 强制 `revokeAllSessionsOfUser(userId)` → 同设备会被踢，防止旧 session 复活。
- 速率限制：`lostpassword` 同 email/同 IP 每 5 分钟最多 1 次；`resetpassword` 同 token 同 IP 每分钟最多 5 次尝试。复用 `src/server/rate-limit.ts`。
- 不暴露 email 是否存在（5.3 已说明）。
- token 必须用 `crypto.timingSafeEqual` 做最终对比（避免 Redis 层泄漏长度差异）。

---

## 7. 50+ Admin API 的角色矩阵

| Surface | role 要求 | 备注 |
|---|---|---|
| `admin.listPosts` | author+ | author 在 service 层强制注入 `filter.authorId = ctx.user.id`，无视前端 filter |
| `admin.getPost`, `admin.previewPost`, `admin.listPostRevisions` | author+ + 所有权 | 加载后 `assert post.authorId === ctx.user.id`，否则 404（不要 403，防探测） |
| `admin.upsertPostMeta`, `admin.savePostDraft`, `admin.publishPostLatest`, `admin.unpublishPost`, `admin.deletePost`, `admin.restorePost` | author+ + 所有权 | 同上；**创建**时 `authorId = ctx.user.id` 强写 |
| `admin.listPages` 与所有 `…Page*` | admin | author 完全无 page 权限 |
| `comment.updateOwn`（新增） | visitor+ | service 层 ownership 兜底；admin 可代写但走 admin shell 旧路径 |
| `comment.requestDeleteOwn`（新增） | visitor+ | 同上 |
| `comment.cancelDeleteOwn`（新增） | visitor+ | 同上 |
| `comment.listMine`（新增） | visitor+ | 自己的全部评论分页 |
| `account.updateProfile`（新增） | visitor+ | 自己的 name / link / badge* / receiveEmail |
| `account.updatePassword`（新增） | visitor+ | 旧→新；成功后 `revokeAllSessionsOfUser` |
| `admin.approveCommentDeletion`（新增） | admin | 处理删除申请 |
| `admin.listCategories` | author+ | 只读 |
| `admin.upsertCategory`, `admin.deleteCategory`, `admin.reorderCategories` | admin | |
| `admin.listTags` | author+ | 只读 |
| `admin.upsertTag` | author+ | 但 author 仅允许「无 id」的创建分支；改名只允许 admin |
| `admin.deleteTag` | author+ + 「无 post 引用」 | service 层校验 `countPostsByTag(tag.id) === 0`；admin 不受此限制 |
| `admin.listImages` | author+ | 只读 |
| `admin.uploadImage` | author+ | `uploaderId = ctx.user.id` |
| `admin.updateImageNote`, `admin.recalculateImageThumbhash`, `admin.deleteImage` | author+ + 所有权 | author 仅自己上传的 |
| `admin.listMusic`, `admin.searchMusic` | author+ | 只读 |
| `admin.addMusic` | author+ | `uploaderId = ctx.user.id` |
| `admin.updateMusic`, `admin.deleteMusic` | author+ + 所有权 | |
| `admin.listFriends`, `admin.upsertFriend`, `admin.deleteFriend` | admin | |
| `admin.listUsers`, `admin.getUser`, `admin.softDeleteUser`, `admin.restoreUser`, `admin.muteUser` | admin | |
| `admin.updateUserRole`（**新增**） | admin | 不允许改自己；不允许把唯一 admin 降级 |
| `admin.inviteAuthor`（**新增**） | admin | 见 §5.2 |
| `admin.sendPasswordReset`（**新增**） | admin | 给指定用户发重置邮件 |
| `admin.bulkApproveUserComments`, `admin.bulkSoftDeleteUserComments` | admin | |
| 所有 `admin.*settings*` | admin | |
| `admin.getCacheStats`, `admin.clearCache`, `admin.reindexSearch` | admin | |
| `admin.renderMath`, `admin.renderMermaid` | author+ | 编辑器预览 |
| `admin.sendTestMail` | admin | |

> 实施时只需把 `requireAdmin: true` 替换成 `requireRole: 'author'` 的清单与服务层的 ownership assert，剩余维持不变。

**前缀路由 gate**：`src/routes/wp-admin.layout.tsx` loader 从 `!admin` 改成 `if (!hasAtLeast(role, 'author'))`。
**Page 路由 gate**：`src/routes/wp-admin.pages.tsx` / `wp-admin.pages.new.tsx` / `wp-admin.pages.edit.tsx` / `wp-admin.users*.tsx` / `wp-admin.categories.tsx` / `wp-admin.friends.tsx` / `wp-admin.comments.tsx` / `wp-admin.settings.*.tsx` 各自 loader 顶部 `requireAdmin(ctx)`。
**公共 chrome 路由 gate**：`/me/comments` loader 顶部 `requireRole(ctx, 'visitor')`，未登录跳登录。

---

## 8. Author 内容隔离的实现位置

**关键不变量**：author 在 admin 列表 / 详情 / 写操作三处都看不到也写不到他人内容。这要在**服务层**（不是 route 层）落地，防止后续新加 route 漏掉。

### Posts

`src/server/cms/posts/service.ts`：

```ts
// 列表
export async function listPostsForAdmin(filters, ctx: AuthedContext) {
  if (ctx.role !== 'admin') {
    filters = { ...filters, authorId: BigInt(ctx.user.id) }   // 强覆盖
  }
  // 既有实现
}

// 详情 / 修改 / 删除
async function loadOwnedPostOr404(id, ctx) {
  const post = await loadPostMeta(id)
  if (!post) throw new ActionFailure(404, ErrorMessages.NOT_FOUND)
  if (ctx.role !== 'admin' && post.authorId?.toString() !== ctx.user.id) {
    throw new ActionFailure(404, ErrorMessages.NOT_FOUND)   // 假装不存在
  }
  return post
}
```

所有 `getPostDetailForAdmin / saveDraft / publishLatest / deletePost / restorePost / unpublishPost / upsertPostMeta(id)` 在入参第一步都调 `loadOwnedPostOr404`。

### Images / Music

`src/server/images/library-service.ts`（新增或就近）增加 `loadOwnedImageOr404`；
`src/server/music/service.ts` 增加 `loadOwnedMusicOr404`。
List 接口对 author 不过滤（author 能看到全部，只是没改权）。

### Tags

`deleteTagForAuthor(tagId, ctx)`：先 `countPostsByTag(tagId)`，> 0 抛 `ActionFailure(409, '该标签已被文章使用')`；= 0 → 复用现有 admin 路径。

---

## 9. 评论体系：admin 审核 vs 用户自管

> 关键澄清：`/wp-admin/comments` 是「**审核队列**」，永远 admin-only；author 和 visitor 都不进这个页面。**自我评论管理**走 `/wp-admin/my/comments`，所有登录用户（含 admin、author、visitor）通用。

### 9.1 三个评论触达面

| Surface | 谁能看 | 显示范围 | 操作 |
|---|---|---|---|
| 文章页内嵌评论区 `routes/post.detail.tsx` / `page.detail.tsx` | 所有人 | approved 全部 + 当前用户自己的 pending / delete-requested（带「审核中」/「已申请删除」徽标） | 匿名：创建；登录用户：在自己的评论行上 inline「编辑 / 申请删除」 |
| **`/wp-admin/my/comments`（新增）** | 任何已登录用户 | **自己**所有评论（approved + pending + delete-requested + 已 soft-delete 但 deletedAt 在 7 天内） | 编辑、申请删除、撤回删除、跳所属文章 |
| `/wp-admin/comments` | admin only | 待审 + 审核通过 + 删除申请 + 已删除 各 tab | 审批通过/拒绝、批准删除、强制删除、恢复、按用户筛选 |

> `/wp-admin/my/comments` 与 `/wp-admin/comments` 在 admin shell 内是**两个独立的导航项**，不会混淆。Visitor 进 admin shell 时左侧导航只剩 `欢迎 / 我的评论` 两项 + 右上角头像下拉的「个人信息 / 近期评论 / 登出」。

### 9.2 评论列表 loader 适配

`src/server/comments/loader.ts:84`（`loadCommentsForPost`）：

```
loadCommentsForPost(slug, ctx):
  base = approved comments (deletedAt IS NULL AND isPending = false AND delete_requested_at IS NULL)
  if ctx.user
    me = comments WHERE userId = ctx.user.id
         AND deletedAt IS NULL
         AND (isPending = true OR delete_requested_at IS NOT NULL)
    return base ∪ me
  else
    return base
```

- 渲染时 `ui/public/comments/CommentItem.tsx` 根据 `comment.userId === ctx.user?.id` 决定是否显示 inline「编辑 / 申请删除」按钮，以及「审核中」/「已申请删除」徽标。
- admin 现在在文章页可以看到所有 pending（既有逻辑），不动。

### 9.3 评论编辑（自己的）

新 API `POST /api/actions/comment/updateOwn`：

- `requireRole: 'visitor'`（visitor / author / admin 都能用，admin 在 `/wp-admin/comments` 还有「以管理员身份编辑任意评论」的另一条路径）
- 入参 `{ commentId, content }`，CSRF token 必填
- service：
  1. `loadComment(commentId)`；若 `c.userId !== ctx.user.id` 且 `ctx.role !== 'admin'` → **404**（不泄漏存在性）
  2. 若 `c.delete_requested_at !== null` → 409「已申请删除，无法编辑」
  3. 若 `countApprovedRepliesOfComment(commentId) > 0` → 409「已有回复，无法再编辑」（避免父被打回 pending 让回复孤悬）
  4. 重写 `content`、`isPending = true`、`updatedAt = now()`
  5. 复用 `sendNewComment(admin)` 通知 admin 有新待审

### 9.4 评论删除申请（自己的）

新 API `POST /api/actions/comment/requestDeleteOwn`：

- `requireRole: 'visitor'`
- 入参 `{ commentId }`，CSRF token 必填
- service：
  1. ownership 校验（同 9.3）
  2. 若 `c.delete_requested_at !== null` → 200 幂等返回
  3. `delete_requested_at = now()`、`delete_requested_by = ctx.user.id`
  4. 不直接 soft-delete；评论仍在但不在公开列表（base 已经过滤）

新 API `POST /api/actions/comment/cancelDeleteOwn`（撤回申请）：

- `requireRole: 'visitor'`
- 校验：仅当 `delete_requested_by === ctx.user.id` 且评论尚未被 admin soft-delete 时允许
- 清空 `delete_requested_*`

### 9.5 Admin 处理删除申请 / 评论编辑

新 admin API `POST /api/actions/admin/approveCommentDeletion`：

- `requireRole: 'admin'`
- 入参 `{ commentId, approve: boolean }`
- `approve=true` → `softDeleteComment(id)`；`approve=false` → 清空 `delete_requested_*` 字段
- admin UI `/wp-admin/comments` 增加 tab「删除申请」（基于 `WHERE delete_requested_at IS NOT NULL`）

admin 可在 `/wp-admin/comments` 任意编辑任意评论（已经存在的能力）— 不需要新 API，但旧的编辑 endpoint 需要复查权限（如果以前是 admin-only 写法，保留即可）。

### 9.6 `/wp-admin/my/comments` 路由

新文件 `src/routes/wp-admin.my.comments.tsx`：

- loader：父 layout 已 `requireRole(ctx, 'visitor')`；本路由 loader 直接 `listMyComments(userId)` 返回当前用户全部评论（paged）。
- 渲染：在 admin shell 内的内容区，复用 `ui/public/comments/CommentItem` 卡片样式但**新增** inline 编辑 / 申请删除 / 撤回删除按钮，每条带「所属文章」链接。
- 未登录访问父 layout 时跳 `/wp-login.php?redirect_to=/wp-admin/my/comments`（已经由 wp-admin.layout 处理）。

新 service：`src/server/comments/loader.ts` 增加 `listMyComments(userId, { page, pageSize })`，按 `createdAt DESC` 分页。

### 9.7 现有评论创建路径的兼容

`createComment`（`src/server/comments/loader.ts:111`）：

- 「已登录」分支判断从 `isAdmin` 改为 `role !== null`。
- 「admin 跳过 muted 检查」分支保留（admin 可以即时评论；author/visitor 不跳过 muted）。
- session 写入字段从 `admin: user.isAdmin` 改成 `role: user.role`。
- `comment.userId` 已经是 user.id，不动。
- author/visitor 的「首评 pending」规则按现有 `countApprovedCommentsByUser` 逻辑继续，不动。

---

## 10. Admin UI 角色适配

### 10.1 `/wp-admin/*` 成为「登录控制台」

把当前「admin only」的 admin shell 升级为**所有登录用户的控制台**。访客（visitor）也能进 admin shell，但只看得到自己被允许的导航项（欢迎 + 我的评论 + 个人信息）。

- `src/routes/wp-admin.layout.tsx` loader：
  - `requireRole(ctx, 'visitor')`（仅要求登录），未登录跳 `/wp-login.php?redirect_to=...`
  - 把 role 注入 layout context；子路由各自再做 `requireAdmin` / `requireAuthor` 等具体校验
  - `/wp-admin` 根 URL 重定向到 `/wp-admin/welcome`（不再默认 dashboard）

### 10.2 NAV 按角色分组

```ts
const NAV = [
  // 所有登录用户
  { label: '欢迎', href: '/wp-admin/welcome', icon: HomeIcon, minRole: 'visitor' },
  // 创作组（author+）
  { label: '文章管理', href: '/wp-admin/posts',     icon: NotebookPenIcon, minRole: 'author' },
  { label: '图片管理', href: '/wp-admin/images',    icon: ImagesIcon,      minRole: 'author' },
  { label: '音乐管理', href: '/wp-admin/musics',    icon: Music2Icon,      minRole: 'author' },
  // 站点管理组（admin only）
  { label: '页面管理', href: '/wp-admin/pages',     icon: FileTextIcon,        minRole: 'admin' },
  { label: '评论管理', href: '/wp-admin/comments',  icon: MessageSquareIcon,   minRole: 'admin' },
  { label: '分类管理', href: '/wp-admin/categories',icon: FolderIcon,          minRole: 'admin' },
  { label: '标签管理', href: '/wp-admin/tags',      icon: TagsIcon,            minRole: 'admin' },
  { label: '友链管理', href: '/wp-admin/friends',   icon: LinkIcon,            minRole: 'admin' },
  { label: '用户管理', href: '/wp-admin/users',     icon: UsersIcon,           minRole: 'admin' },
  { label: '系统设置', href: '/wp-admin/settings/general', icon: SettingsIcon, minRole: 'admin' },
]
```

`AdminShell` 渲染前按 `currentUser.role` 用 `hasAtLeast` 过滤。后端 route loader 仍各自硬校验，**前端隐藏不是安全边界**，只是 UX。

### 10.3 右上角头像下拉（替换现有 logout 按钮）

新组件 `src/ui/admin/shell/UserMenu.tsx`，放在 `AdminShell` header 右侧：

```
┌──────────────────────────┐
│ 👤 个人信息               │  → /wp-admin/my/profile
│ 💬 近期评论               │  → /wp-admin/my/comments
│ ──────────────────────── │
│ 🚪 登出                   │  → /wp-login.php?action=logout
└──────────────────────────┘
```

- Trigger：头像（gravatar 或 `badgeName` 首字母圆形，与现有评论 badge 复用同套 CSS 变量）
- 用 `shadcn/ui` 的 `DropdownMenu` 组件实现
- 移除 `AdminShell` 现有顶栏右侧的「退出登录」按钮（已折叠进下拉）

### 10.4 `/wp-admin/my/profile` 个人信息页

新路由 `src/routes/wp-admin.my.profile.tsx`，所有登录用户可访问。

| 字段 | 谁可改 | 备注 |
|---|---|---|
| name | ✅ 自己 | unique 校验复用 `findUserByEmail` 的反向逻辑（如有重名） |
| email | ✅ 自己 | 改 email **必须**先发送验证邮件到新地址（复用 verification 表，purpose=`email-change`），点链接确认后再生效；**这次只实现：admin 可在 `/wp-admin/users` 改任意人 email 不走验证，自己改 email 走验证**。如果嫌复杂，**这一期先禁用「自己改 email」**，只显示只读 |
| password | ✅ 自己 | 旧密码 + 新密码 + 重复新密码；admin 在 `/wp-admin/users` 改别人密码不走此页（按 §5.2 走重置邮件） |
| link（个人主页） | ✅ 自己 | |
| badgeName / badgeColor / badgeTextColor | ✅ admin / author，❌ visitor | author 自己可设，作为评论徽章 |
| receiveEmail | ✅ 自己 | 是否接收回复邮件 |
| 角色 | ❌ 自己 | 显示但不可改 |
| 头像 | ✅ 自己 | 复用现有 gravatar 镜像逻辑（不变） |

> **本次先不实现「自己改 email」**：复杂度高，且业务上极少。`/wp-admin/my/profile` 显示 email 为只读，需要改请联系管理员。这条决策写入页面 hint。

新 API：

- `comment.updateOwnProfile`（新增）→ `requireRole: 'visitor'`，更新 name/link/badge*/receiveEmail
- `comment.updateOwnPassword`（新增）→ `requireRole: 'visitor'`，bcrypt 校验 oldPassword，写 newPassword，**消费成功后 `revokeAllSessionsOfUser` 把本设备也踢掉重登**（确保密码改了所有 session 都失效）

### 10.5 `/wp-admin/welcome` 角色感知欢迎页

新路由 `src/routes/wp-admin.welcome.tsx`，所有登录用户可访问；同一页面按 role 渲染不同 widget 集合。

**通用顶部条**（所有角色）：

```
你好 <name>，<时段问候语>
<role 徽章>          <最后登录时间 from lastIp/lastUa>
```

时段问候语按本地时间分支（loader 注入服务端时间避免时区问题）：

| 时段 | 问候 |
|---|---|
| 23:00–04:59 | 夜深了，<name>，还没睡么？记得早点休息 |
| 05:00–10:59 | 早上好，<name>，新的一天开始啦 |
| 11:00–13:59 | 中午好，<name>，记得吃午饭 |
| 14:00–17:59 | 下午好，<name> |
| 18:00–22:59 | 晚上好，<name> |

文案可走 `setting('blog.general')` 里新增一个 `welcomeMessages` 字段做覆盖（**本期不做**，先硬编码）。

**Admin widget 矩阵**（参考 WordPress dashboard，全部 lazy-loaded 通过 SSR loader 一次性带回）：

| Widget | 内容 | 数据源 |
|---|---|---|
| 站点速览 | 文章数 / 页面数 / 评论总数 / 待审评论数 / 已注册用户数 / 图片数 / 音乐数 | 现有 query helpers + 新 `countXxx` 函数 |
| 系统健康 | Mail ready / S3 storage on / Cache hit rate (24h) / Recent error count | 现有 `checkMailReady` / `setting('blog.assets').enabled` / `getCacheStats` |
| 待审评论 (≤5) | 标题 + 摘要 + 「通过 / 删除」inline 按钮 | `loadPendingComments(limit=5)` |
| 最新草稿 (≤5) | 文章标题 + 上次保存时间 + 「编辑」按钮 | `listLatestDraftsForAdmin(limit=5)` |
| 删除申请 (≤5) | 评论摘要 + 「批准 / 拒绝」 | `loadDeleteRequests(limit=5)` |
| 快速操作 | 「新文章」「新页面」「邀请作者」「站点设置」 4 个大按钮 | 链接 |

**Author widget 矩阵**：

| Widget | 内容 | 数据源 |
|---|---|---|
| 我的创作速览 | 我的已发布 / 草稿 / 待审文章数 / 文章总浏览（如可得） | `listPostsForAdmin(authorId=self)` 聚合 |
| 最近编辑 (≤5) | 我的最近编辑文章 + 「继续编辑」按钮 | `listLatestDraftsForAdmin(authorId=self)` |
| 快速操作 | 「写新文章」「上传图片」 2 个大按钮 | |

**Visitor widget 矩阵**：

| Widget | 内容 | 数据源 |
|---|---|---|
| 我的评论速览 | 我的总评论 / 待审 / 已申请删除 | `countMyComments(userId)` |
| 我的最近评论 (≤5) | 评论摘要 + 所属文章 + 「编辑 / 申请删除」 | `listMyComments(userId, limit=5)` |
| 推荐阅读 | 站长推荐的若干文章（按 published_at DESC，3 条） | 现有 catalog |

> **实现节奏建议**：`/wp-admin/welcome` 是「锦上添花」，建议第一期只做 (1) 顶部问候条 + (2) 角色对应的 1 个核心 widget；其余 widget 排到后续迭代。本设计文档只描述形态，落地时按这个梯度推进。

### 10.6 用户管理增强

`/wp-admin/users` 列表新增列「角色」、按钮「邀请作者」、行操作「改角色 / 发重置邮件」。
`UserEditDialog` 增加角色下拉，但当前登录管理员看自己那行时角色控件禁用 + tooltip「不能修改自己的角色」（后端再加一次硬校验）。

### 10.7 公共站点 chrome 的登录指示（可选）

公共 chrome（`ui/public/chrome/Header.tsx`）右上角对登录用户显示一个小头像，点击 → `/wp-admin/welcome`。未登录显示「登录」链接。这是 UX 入口，**不**是权限边界。

---

## 11. 安全约束清单（评审用）

| 风险 | 缓解 |
|---|---|
| IDOR：author 通过改 URL 编辑他人文章 | service 层 `loadOwnedPostOr404` 兜底，返回 404 而非 403（不泄漏存在性） |
| 提权：admin 把自己降级或唯一 admin 被删除 | `updateUserRole` / `softDeleteUser` / `updateUserRole` 服务端硬校验「目标 ≠ self」且「降级后仍有 ≥1 admin」 |
| token 重用 | 消费 token 走 DB 事务 `DELETE … RETURNING` + 更新 password 原子；成功后立即 `revokeAllSessionsOfUser` |
| 邮箱枚举 | lostpassword 不论结果都 200，相同延迟 |
| Brute force 登录 / 重置 | 复用 `tryRateLimit`：login 同 IP 每分钟 5 次 + 同 email 每小时 10 次；reset 同 token 每分钟 5 次；lostpassword 同 IP/email 每 5 分钟 1 次 |
| CSRF | 所有非 `/api/auth` POST 都走现有 `csrf-token` cookie + 表单 token；新增 `comment.updateOwn` / `comment.requestDeleteOwn` 同样要 |
| Session 被 stale role 利用 | 任何 role 改动 / softDelete 用户 / 重置密码成功，强制 `revokeAllSessionsOfUser` |
| Open redirect | login `redirect_to` 参数继续走 `safeRedirect`（应已有），不接受外域 |
| Author 借标签删除骚扰 | `deleteTag` 服务层硬校验 `countPostsByTag === 0`，author 不可改名（只 admin） |
| 邀请邮件被滥发 | `admin.inviteAuthor` 同 admin 同 email 1h 1 封；admin 自己也受限 |
| 时间侧信道 | CSRF / token 比较一律 `crypto.timingSafeEqual` |
| 已存在的 user.password='' 账户被「忘记密码」直接接管 | lostpassword 分支要求 `countApprovedCommentsByUser(uid) >= 1`，且只把无角色记录升级为 visitor，不升级为 admin/author |

---

## 12. 文件变更清单

### 新增

- `src/server/auth/rbac.ts` — `Role`、`hasAtLeast`、`requireRole/requireAdmin/requireAuthor`、`canEditPost/Image/Music`、`canDeleteTag`、`canManageComment`
- `src/server/auth/verification-tokens.ts` — `issueResetToken / issueSetupToken / consumeToken / revokeTokensFor / purgeExpired`（DB 事务，基于 `verification` 表）
- `src/server/db/query/verification.ts` — drizzle 薄包装
- `src/server/auth/session-storage.ts`（扩展）— `revokeAllSessionsOfUser(userId)`，`user_sessions:<userId>` Set 维护
- `src/server/email/templates/PasswordReset.tsx`
- `src/server/email/templates/AuthorInvite.tsx`
- `src/server/db/query/user.ts`（扩展）— `insertAuthor`, `updateUserRole`, `countAdmins`, `softDeleteUserAndRevoke`
- `src/server/db/query/comment.ts`（扩展）— `loadOwnedCommentOr404`, `requestDeleteComment`, `clearDeleteRequest`, `countApprovedRepliesOfComment`, `listMyComments`
- `src/server/db/query/tag.ts`（扩展）— `countPostsByTag`
- `src/routes/api/actions/admin.updateUserRole.ts`
- `src/routes/api/actions/admin.inviteAuthor.ts`
- `src/routes/api/actions/admin.sendPasswordReset.ts`
- `src/routes/api/actions/admin.approveCommentDeletion.ts`
- `src/routes/api/actions/comment.updateOwn.ts`
- `src/routes/api/actions/comment.requestDeleteOwn.ts`
- `src/routes/api/actions/comment.cancelDeleteOwn.ts`
- `src/routes/api/actions/comment.listMine.ts`
- `src/routes/api/actions/account.updateProfile.ts` — 自己改 name / link / badge* / receiveEmail
- `src/routes/api/actions/account.updatePassword.ts` — 自己改密码（旧→新）；成功后强制全 session 失效
- `src/routes/wp-admin.welcome.tsx` — 角色感知欢迎页（loader 按 role 聚合不同 widget 数据）
- `src/routes/wp-admin.my.profile.tsx` — 个人信息页（loader+action）
- `src/routes/wp-admin.my.comments.tsx` — 「近期评论」自管页
- `src/ui/admin/welcome/WelcomeView.tsx` — 顶部条 + 按 role 拼装 widget
- `src/ui/admin/welcome/widgets/` — 各 widget 子组件（SiteOverview, SystemHealth, PendingComments, RecentDrafts, DeleteRequests, MyCreationOverview, MyRecentEdits, MyCommentsOverview, MyRecentComments, QuickActions）。第一期只实现核心 3 个，其余排后
- `src/ui/admin/my/MyProfileView.tsx`
- `src/ui/admin/my/MyCommentsView.tsx`
- `src/ui/admin/shell/UserMenu.tsx` — 右上角头像 + DropdownMenu（个人信息 / 近期评论 / 登出）
- `src/ui/admin/users/InviteAuthorDialog.tsx`
- `src/ui/admin/users/RoleSelect.tsx`
- `src/ui/admin/comments/DeleteRequestsTab.tsx` — `/wp-admin/comments` 新 tab
- `drizzle/<timestamp>_rbac/` — `migration.sql` + `snapshot.json`

### 修改

- `src/server/db/schema.ts` — `user`: `+role`, `-isAdmin`; `comment`: `+delete_requested_at`, `+delete_requested_by`
- `src/server/auth/primitives.ts` — login 写 `role`；移除 `isAdmin(session)`，改为 `getSessionRole(session)` + `hasAtLeast`
- `src/server/auth/csrf.ts` — 不动
- `src/server/middleware/session.ts` — `SessionContext.role`
- `src/server/auth/context.ts` — `RouteRequestContext.role`
- `src/server/route-helpers/api-handler.ts` — `defineApiAction({ requireRole })`；`requireAdmin: true` 兼容路径
- `src/routes/wp-login.tsx` — 增加 `action=lostpassword / resetpassword / accept-invite` 分支
- `src/routes/wp-admin.layout.tsx` — gate 改为 `requireRole(ctx, 'author')`
- `src/routes/wp-admin.pages*.tsx`、`wp-admin.categories.tsx`、`wp-admin.friends.tsx`、`wp-admin.comments.tsx`、`wp-admin.users*.tsx`、`wp-admin.settings.*.tsx` — loader 顶部加 `requireAdmin(ctx)`
- `src/server/cms/posts/service.ts` — 注入 author 过滤；`loadOwnedPostOr404`
- `src/server/images/*` 与 `src/server/music/*` 服务层 — uploaderId 写入 + ownership 校验
- `src/server/comments/loader.ts` — 列表分支按 role；`createComment` 用 role；`sendXxx` 通知保留
- `src/routes/api/actions/admin.deleteTag.ts` — 加 `countPostsByTag === 0` 分支（author）
- `src/routes/api/actions/admin.upsertTag.ts` — author 只允许「无 id」分支
- 所有 `src/routes/api/actions/admin.*.ts` — 按表 §7 改 `requireAdmin: true` → `requireRole: 'author'`（仅创作类）
- `src/ui/admin/shell/AdminShell.tsx` — NAV 按 role 过滤，集成 `UserMenu`，移除顶栏现有「退出登录」按钮（折叠进下拉）
- `src/ui/admin/users/UsersView.tsx`, `UsersTable.tsx`, `UserDetailView.tsx` — 角色列、邀请按钮、行操作
- `src/shared/users.ts` — `AdminUserDto.role: 'admin' | 'author' | 'visitor' | null`，删 `isAdmin`
- `src/server/comments/loader.ts` 与 `src/ui/public/comments/CommentItem.tsx` — visitor 看到自己的 pending / 删除申请的标识；公共评论行加 inline「编辑 / 申请删除」按钮（仅对 `comment.userId === ctx.user?.id` 显示）
- `src/ui/public/chrome/Header.tsx` — 集成 `UserMenu`（登录用户右上角下拉）
- `src/routes/wp-admin.comments.tsx` — 加「删除申请」tab，loader 顶部 `requireAdmin(ctx)`
- `tests/contract.cookie.test.ts` — session payload 含 `role`
- `tests/api-handler.test.ts` — `requireRole`

### 删除

- `is_admin` 列与所有 `userSession(session)?.admin === true` 调用点（替换为 `role === 'admin'`）。
- 无文件级删除；CSRF 与 session 体系保留。

---

## 13. 迁移与上线步骤

1. **Drizzle 迁移**（一次性，需停一次写入或在凌晨执行）：
   - 加 `user.role` 列
   - `UPDATE user SET role='admin' WHERE is_admin=true`
   - 验证 admin count 一致
   - 删 `user.is_admin` 列
   - 加 `comment.delete_requested_*` 列
2. **代码上线**（同一 release）：rbac.ts、helpers、API 改造、UI 改造、新邮件模板。
3. **会话**：`SessionUser` 形状改了，**老 cookie 反序列化后 `role` 字段缺失**。中间件加兜底：若 `user.role` 字段缺失 → 用 user.id 查一次 DB 补，写回 session（一次性升级），后续命中 cookie。**这意味着上线后所有用户不需要重登**。
4. **冒烟脚本**：
   - 创建一个 author，邀请邮件可点；
   - author 看不到 page / category / settings，只看见自己文章；
   - author 创建文章成功，admin 列表能看到；
   - author 改他人文章 URL → 404；
   - visitor 申请删除 / 编辑评论闭环；
   - admin 改自己角色被拒绝；唯一 admin 被删被拒绝；
   - lostpassword 对不存在邮箱返回 200 不发信。
5. **回滚预案**：保留 `is_admin` 列直到迁移成功 + 主链路冒烟通过后再 drop；提前 24h 不 drop。

---

## 14. 验证

- `vp check` 通过（类型 + lint + fmt）。
- `vp test run` 通过：新增 `tests/rbac.helpers.test.ts`、`tests/service.author-isolation.test.ts`、`tests/service.password-reset.test.ts`、`tests/api-handler.role.test.ts`，并更新 `tests/contract.cookie.test.ts` 与 `tests/service.auth-flow.test.ts`。
- 手工流程（dev server）：§13.4 冒烟脚本全跑。
- 安全 sanity：
  - `curl -X POST /api/actions/admin/getPost?id=<别人文章>` 携带 author cookie → 404
  - `curl -X POST /api/actions/admin/deleteTag` 携带 author cookie 对被引用 tag → 409
  - 重置邮件 token 重复消费第二次 → 通用错误「链接无效或已过期」
  - 一个 visitor 编辑/申请删除/撤回删除自己评论的端到端
  - visitor 登录后访问 `/wp-admin/`：自动 redirect 到 `/wp-admin/welcome`；侧栏只剩「欢迎 / 近期评论」；右上角头像下拉三项工作
  - author 进入 `/wp-admin/comments` → 应该 403/404；进入 `/wp-admin/welcome` 看到自己版本 widget；`/wp-admin/my/profile` 能改 name/badge/password
  - admin 在 `/wp-admin/welcome` 看到完整 widget；改自己 password 后 → 当前 session 立即失效跳登录
  - `tryRateLimit` 卡到第二次 lostpassword → 429
