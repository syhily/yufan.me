# 管理后台路径系统性重设计划

## 1. 设计目标

- **去 WordPress 化**：彻底摒弃 `/admin` 前缀与 `.php` 后缀，摆脱遗留 CMS 的视觉与 URL 烙印。
- **对齐 Ghost 范式**：参考 Ghost 的现代路径设计，让管理后台呈现商业级 SaaS 产品的专业感。
- **层级扁平化**：编辑器、设置、用户中心等高频路径缩短，降低认知与操作成本。
- **功能缺口补齐**：以 Ghost 为基准，梳理缺失功能并规划对应路径。
- **彻底切割**：旧 `/admin`、`/signin.php` 等路径直接废弃，不保留任何兼容重定向，与新体系彻底划清界限。

---

## 2. 路径重命名总览（当前 → 新路径）

### 2.1 认证与安装

| 当前路径 | 新路径 | 说明 |
|---------|--------|------|
| `/signin.php` | `/admin/signin` | Ghost: `/signin/*`；**旧路径直接废弃，无重定向** |
| `/signin.php?action=logout` | `/admin/signout` | Ghost: `/signout`；**旧路径直接废弃，无重定向** |
| `/admin/install.php` | `/admin/setup` | Ghost: `/setup/*`；**旧路径直接废弃，无重定向** |
| `/admin/install/settings.php` | `/admin/setup/settings` | 安装第二阶段；**旧路径直接废弃，无重定向** |

### 2.2 管理后台 SPA 框架路径

**旧 `/admin/*` 路径全部废弃，不保留任何重定向。**

| 当前路径 | 新路径 | Ghost 对应 | 说明 |
|---------|--------|-----------|------|
| `/admin` | `/admin` | `/ghost/` | 入口重定向至 `/admin/dashboard` |
| `/admin/welcome` | `/admin/dashboard` | `/`, `/dashboard` | Dashboard 取代 Welcome |
| `/admin/posts` | `/admin/posts` | `/posts` | 文章列表 |
| `/editor/post/new` | `/editor/post/new` | `/editor/post` | 新建文章 |
| `/editor/post/:id` | `/editor/post/:id` | `/editor/*` | **独立编辑器路径** |
| `/admin/pages` | `/admin/pages` | `/pages` | 页面列表 |
| `/editor/page/new` | `/editor/page/new` | `/editor/page` | 新建页面 |
| `/editor/page/:id` | `/editor/page/:id` | `/editor/*` | **独立编辑器路径** |
| `/admin/comments` | `/admin/comments` | — | 评论管理（Ghost 无独立评论后台） |
| `/admin/categories` | `/admin/categories` | — | 分类管理（Ghost 无此功能） |
| `/admin/tags` | `/admin/tags` | `/tags` | 标签管理 |
| `/admin/friends` | `/admin/friends` | — | 友链管理（中文博客特色保留） |
| `/admin/images` | `/admin/library/images` | — | 图片库 |
| `/admin/musics` | `/admin/library/music` | — | 音乐库 |
| `/admin/users` | `/admin/users` | `/members` | 用户列表 |
| `/admin/users/:id` | `/admin/users/:id` | `/members/:member_id` | 用户详情 |
| `/admin/sessions` | `/admin/security/sessions` | — | 会话管理 |
| `/admin/my/profile` | `/admin/me/profile` | — | 个人资料 |
| `/admin/my/comments` | `/admin/me/comments` | — | 我的评论 |
| `/admin/my/sessions` | `/admin/me/sessions` | — | 我的设备 |
| `/admin/analytics` | `/admin/analytics` | `/analytics` | 访问统计概览 |
| `/admin/analytics/realtime` | `/admin/analytics/realtime` | — | 实时统计 |
| `/admin/settings/*` | `/admin/settings/*` | `/settings/*` | 设置子页 |

### 2.3 为什么编辑器要独立为 `/editor/*`

Ghost 将编辑器放在 `/editor/*` 而非 `/ghost/editor/*`，原因是：
- 编辑器进入 **focus mode**（全屏沉浸），需要独立的视觉与导航上下文。
- 编辑器是内容创作者最高频的页面，缩短路径降低认知成本。
- 与列表页分离后，浏览器标签更易区分（`Editor` vs `Posts`）。

我们的 `PostEditorShell` / `PageEditorShell` 已实现 focus mode，将路径提升至 `/editor/*` 与现有技术方案天然契合。

---

## 3. 新增路径规划（Ghost 有而当前缺失的功能）

### 3.1 高优先级（核心商业级功能）

| 新路径 | Ghost 对应 | 功能描述 | 优先级 |
|-------|-----------|---------|--------|
| `/admin/site` | `/site` | **网站设计中心**：主题切换、导航拖拽、颜色/字体实时预览、自定义 CSS | P0 |
| `/admin/posts/analytics/:postId` | `/posts/analytics/:postId` | **文章级分析**：单篇文章的阅读量、来源、阅读完成率、读者地理分布 | P0 |
| `/editor/post/:id/analytics` | `/posts/analytics/:postId` | 编辑器内嵌「分析」标签页，切换至文章数据视图 | P0 |
| `/admin/restore` | `/restore` | **回收站**：已删除文章/页面的列表与一键恢复 | P1 |
| `/admin/analytics/mentions` | `/mentions` | **反向链接追踪**：谁在引用本站文章 | P1 |

### 3.2 中优先级（生态与扩展）

| 新路径 | Ghost 对应 | 功能描述 | 优先级 |
|-------|-----------|---------|--------|
| `/admin/members` | `/members` | **会员/读者系统**：邮件订阅者管理、付费会员（未来可扩展）、邮件群发 | P1 |
| `/admin/members/:id` | `/members/:member_id` | 会员详情与互动历史 | P1 |
| `/admin/members/import` | `/members` (import) | 从 CSV/Mailchimp 导入订阅者 | P2 |
| `/admin/activitypub` | `/activitypub` | ActivityPub 联邦功能：与 Mastodon/Bluesky 互通 | P2 |
| `/admin/migrate` | `/migrate/*` | 数据迁移工具：从 WordPress/Ghost/Hexo 导入 | P2 |

### 3.3 低优先级（商业化与探索）

| 新路径 | Ghost 对应 | 功能描述 | 优先级 |
|-------|-----------|---------|--------|
| `/admin/explore` | `/explore/*` | 探索流：发现其他博客、主题市场 | P3 |
| `/admin/pro` | `/pro/*` | 专业版/计费管理（如未来推出付费服务） | P3 |

---

## 4. 实施阶段划分

### Phase 1：路径重命名（纯重构，零功能新增）

**目标**：完成所有现有路径的迁移与 301 重定向，让 URL 体系先干净起来。

**文件清单**：
1. `src/routes.ts` — 更新全部 route 定义。
2. `src/routes/auth/signin.tsx` → `src/routes/auth/signin.tsx`（或迁移至 `src/routes/admin/signin.tsx`）。
3. `src/ui/admin/shell/AdminShell.tsx` — 更新 `NAV` 数组中全部 `to` 字段。
4. `src/ui/admin/shell/AdminShell.tsx` — 更新 UserMenu 中 `/admin/my/*` → `/admin/me/*`。
5. `src/ui/admin/posts/PostEditorShell.tsx` — 更新 `editPath` 与返回链接。
6. `src/ui/admin/pages/PageEditorShell.tsx` — 同上。
7. `src/ui/admin/posts/PostsView.tsx` — 更新所有 `Link to` 路径。
8. `src/ui/admin/pages/PagesView.tsx` — 同上。
9. `src/ui/admin/users/UsersTable.tsx` / `UserDetailView.tsx` — 更新导航链接。
10. `src/ui/admin/settings/BackupView.tsx` — 更新链接。
11. `src/ui/admin/welcome/VisitSummaryCard.tsx` / `PendingModerationPanel.tsx` — 更新链接。
12. `src/server/http/controllers/admin/*.controller.ts` — oRPC 路径通常以 `/admin/*` 开头，**不需要改动**（API 路径与前端路由解耦）。
13. `src/server/http/middlewares/wp-decoy.ts` — 如果存在 WordPress 兼容层，更新重定向规则。

**无向后兼容重定向**：所有旧路径直接废弃，不维护任何重定向逻辑。这是一个干净的切割，避免任何 WordPress 遗留 URL 继续暴露在系统中。

### Phase 2：Dashboard 升级

**目标**：将 `/admin/welcome` 升级为真正的 Dashboard。

**内容扩展**：
- 保留现有「待审评论」「访问概览」「最近草稿」widget。
- 新增：最新发布文章列表、最近 7 天访问趋势微型图表、系统健康状态（存储/缓存/队列）、快捷操作按钮（新建文章/页面/上传图片）。
- 路径：`/admin/dashboard` 取代 `/admin/welcome`。

### Phase 3：编辑器路径独立化

**目标**：将编辑器从 `/editor/post/:id` 迁移至 `/editor/post/:id`。

**技术要点**：
- 编辑器路由不再嵌套在 `routes/admin/layout.tsx` 之下，而是作为顶层路由（但共享 `admin.css` + 字体）。
- 需要新建 `src/routes/editor/layout.tsx`：加载 admin 样式、CSRF token、当前用户信息，但隐藏侧边栏（focus mode 由编辑器自身控制）。
- `PostEditorShell` 与 `PageEditorShell` 中硬编码的 `editPath` 更新为新的 URL 模式。
- 旧路径 `/editor/post/:id` 301 重定向至 `/editor/post/:id`。

### Phase 4：新增核心功能

按 P0 → P1 → P2 优先级依次实现：
1. `/admin/site` 网站设计中心
2. `/admin/posts/analytics/:postId` 文章分析
3. `/admin/restore` 回收站
4. `/admin/members` 会员系统
5. `/admin/migrate` 迁移工具

---

## 5. 技术注意事项

### 5.1 路径别名与引用规范

- 所有硬编码路径必须集中为常量（例如 `src/shared/utils/paths.ts`），避免字符串散落在 UI 组件中。
- 当前项目中 `PostsView.tsx`、`PagesView.tsx`、`AdminShell.tsx` 等已有多处硬编码 `/admin/...`，Phase 1 需一次性替换为常量引用。

### 5.2 oRPC API 路径

- 当前 API 以 `/admin/*`（如 `/admin/posts/list`）开头，**这与新的前端路径前缀 `/admin` 不冲突**，因为 API 走 `/rpc/*`（由 `RPCHandler` 挂载）。
- 但建议未来 API 路径也统一为 `/rpc/admin/*` 以彻底解耦，本次计划中不强制改动。

### 5.3 React Router 路由 ID 稳定性

- React Router 7 从文件路径派生 route id。移动文件后，route id 改变，但这对内部使用无影响（`useNavigate` 与 `Link` 使用 URL path，不使用 route id）。
- 唯一影响：`+types/*.ts` 文件需要重新生成（`vp dev` 会自动处理）。

### 5.4 无遗留路径兼容

- 本次重构不保留任何旧路径重定向。
- 若未来需要兼容已分发的外部链接，可在 Nginx / CDN 层统一处理，不污染应用代码。

### 5.5 安装门控中间件

- `honoInstallGateMiddleware` 中硬编码的路径已同步更新。
- `ensureInstalledOrRedirect()` / `ensureNoAdminOrRedirect()` 等 helper 的跳转目标需更新。

---

## 6. 与 Ghost 的功能差异决策

以下 Ghost 功能经过评估，**本期不跟进**，原因如下：

| Ghost 功能 | 决策 | 原因 |
|-----------|------|------|
| ActivityPub (`/activitypub`) | 暂缓 | 联邦社交协议在国内使用场景有限，ROI 低 |
| Explore (`/explore`) | 暂缓 | 需要平台级生态支撑，单站博客无意义 |
| Pro/Billing (`/pro`) | 暂缓 | 商业化基础设施尚未就绪 |
| `/setup/onboarding` | 暂缓 | 当前两阶段安装已足够 |

以下功能**保留我方特色**，不跟随 Ghost：

| 功能 | 说明 |
|------|------|
| 分类管理 (`/admin/categories`) | Ghost 无分类，仅标签；中文博客需分类 |
| 友链管理 (`/admin/friends`) | Ghost 无此功能；中文博客生态刚需 |
| 音乐库 (`/admin/library/music`) | Ghost 无此功能；我方特色保留 |

---

## 7. 验收标准

- [ ] 访问 `/signin.php` 返回 404（或已由 Nginx 拦截）
- [ ] 访问 `/admin` 返回 404（或已由 Nginx 拦截）
- [ ] 所有 Admin 侧边栏链接指向新路径且无 404
- [ ] 编辑器内「返回列表」链接正确
- [ ] 文章/页面列表中的「编辑」链接指向 `/editor/*`
- [ ] 用户菜单中「个人信息/我的评论/登录设备」指向 `/admin/me/*`
- [ ] 安装门控在新路径下正常工作
- [ ] `vp test` 全量通过（所有 contract 测试、路径测试）
- [ ] 旧路径重定向通过 curl 验证返回 301
