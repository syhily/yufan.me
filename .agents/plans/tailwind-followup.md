# Tailwind 后续修复 Plan（媒体查询回退 + 命名一致性收尾）

## Context

经过 Groups 1-8 的重构（取消冗余 `dark:`、抽出 FAB variant、统一 button hover token、文章标题色、Shiki 双主题、墨色阶梯重命名、prefers-color-scheme 回退），整体 token 架构进入良好状态。但回归式审阅发现 Group 7 的媒体查询回退引入了两个真实的 regression（不依赖 cookie 的暗色用户会看到错误的渲染），以及若干语义不一致和样式卫生问题。

本 Plan 把所有遗留项分组为四个 Group（9-12），按风险/重要性递减排序，按组独立提交。每组完成后跑一次 `vp check && vp test run && vp build`，前两组完成后用 dev server 做一次 noscript 模拟（DevTools "Disable JavaScript" + emulate `prefers-color-scheme: dark`）确认 regression 消除。

## 总览

| Group | 主题 | 风险 | 行数估算 |
|---|---|---|---|
| 9 | 媒体查询回退 regression 修复（A1+A2+A3） | 高（用户可见） | +60/-30 |
| 10 | Ink 阶梯单调性 + warn/alert 暗色调（B1+B2+B3+B4） | 中 | +30/-20 |
| 11 | 样式表卫生（C1+C2+C3+C6+C7） | 低 | +40/-100 |
| 12 | `--ink-on-dark` 双用途文档化（C5） | 极低 | +6/-0 |

策略性后续（C4 `light-dark()` 迁移、OKLCH token 值、cn.ts 自动生成）在本 Plan 末尾以 "Strategic" 段落列出，不在执行队列里。

---

## Group 9 — 媒体查询回退 regression 修复

直接对应审阅 A1+A2+A3。两个用户可见的 bug 加一个注释陈旧。

### 9.1 `aplayer.css` 在 noscript + 系统暗色下退化为浅色皮肤

**根因**：`src/assets/styles/aplayer.css` 的全部 25 条规则都以 `.dark .aplayer*` 为选择器开头。Group 7 加的 `@media (prefers-color-scheme: dark) :root:not(.light, .dark)` 块只重绑了 token 值（`--surface`、`--ink-2` 等），不会让 `.dark .aplayer*` 选择器匹配。所以无 cookie 的暗色 OS 访客拿到的是 aplayer 包内置的浅色皮肤画在深色页面上。

**修复**：在 `aplayer.css` 末尾追加一个 `@media (prefers-color-scheme: dark) { :root:not(.light, .dark) .aplayer* { … } }` 块，把现有 25 条规则的选择器复制一份，body 保持不变。

**具体改动**：把 `src/assets/styles/aplayer.css:7-123` 的每条规则镜像一份，包成 `@media`。例如：

```css
/* 现有 */
.dark .aplayer { ... }
.dark .aplayer .aplayer-pic { ... }
/* ...其余 23 条 */

/* 新增 */
@media (prefers-color-scheme: dark) {
  :root:not(.light, .dark) .aplayer { ... }
  :root:not(.light, .dark) .aplayer .aplayer-pic { ... }
  /* ...其余 23 条 */
}
```

**风险注意**：这是机械复制，body 完全相同；任何未来对 `.dark .aplayer*` 规则的修改都必须同步两处。考虑顺便：

- 在文件顶部加一行 ASCII 注释 `/* APlayer dark skin overrides duplicated under media query for noscript users */`。
- （可选优化）把 25 条规则的 body 提取到 CSS 变量然后只在选择器层面分别绑定。但 aplayer 涉及的属性混杂（background/color/fill/filter/border-color），抽 token 反而更乱。直接复制是务实选择。

**契约测试建议**：在 `tests/contract.boundaries.test.ts` 加一个 assertion，正则统计 `aplayer.css` 内 `.dark .aplayer` 和 `:root:not(.light, .dark) .aplayer` 的出现次数应相等，防止后续单边修改导致漂移：

```ts
const aplayer = readFileSync('src/assets/styles/aplayer.css', 'utf8')
const darkRuleCount = (aplayer.match(/\.dark\s+\.aplayer/g) ?? []).length
const mediaRuleCount = (aplayer.match(/:root:not\(\.light,\s*\.dark\)\s+\.aplayer/g) ?? []).length
expect(darkRuleCount).toBe(mediaRuleCount)
```

### 9.2 `ThemeToggle` 公共 variants 在 noscript + 系统暗色下显示错误图标

**根因**：`src/ui/public/chrome/ThemeToggle.tsx:31-41`（floating）和 `:53-71`（rail）用 JS 条件渲染：`resolvedTheme === 'dark' ? <Sun /> : <Moon />`。SSR 端 `resolvedTheme` 由 `initialResolved` 种子初始化，无 cookie 时为 `undefined` → ThemeProvider 默认 `'light'`。所以 noscript + 暗色 OS 用户会看到 Moon 图标（"点击切换到暗色"）画在已经是暗色的页面上。即便 JS 用户也会有 1ms 的图标闪烁。

**修复**：把两个公共 variants 改成与 admin variant 同样的 CSS 驱动双图标模式（lines 74-86 已经是正确写法）：两个图标都在 DOM 里，用 `dark:scale-0 dark:opacity-0` 和 `dark:scale-100 dark:opacity-100` 切换。因为 Group 7 已经把 `@custom-variant dark` 扩展到含媒体查询分支，CSS swap 会自动跟随 noscript 状态。

**改动后形态**（floating variant 示例）：

```tsx
if (variant === 'floating') {
  return (
    <Button variant="fab" size="iconLg" shape="pill" onClick={toggle} title={label} aria-label={label}>
      <IconButtonContent>
        <Sun size="1em" aria-hidden className="m-icon-inset transition-all dark:scale-0 dark:opacity-0" />
        <Moon
          size="1em"
          aria-hidden
          className="m-icon-inset absolute inset-0 m-auto scale-0 opacity-0 transition-all dark:scale-100 dark:opacity-100"
        />
      </IconButtonContent>
    </Button>
  )
}
```

注意：
- `IconButtonContent` 内部应有定位容器；如果两个绝对定位的 SVG 重叠需要居中，加 `inset-0 m-auto`。可能需要先 Read `IconButtonContent.tsx` 确认其内部布局。
- Light mode 默认显示 Moon（"暗"），dark mode 显示 Sun（"亮"）—— 这是 admin variant 的逻辑，对应"显示当前要切换到的目标"。如果业务希望反过来（显示当前所在），调换两个图标的位置。
- `label` 的计算 `resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'` 仍然依赖 `resolvedTheme`，noscript 用户会拿到错误的 `aria-label`。两个解决方案：
  1. 给 SR 用户提供两个 label，CSS 隐藏其中一个：
     ```tsx
     <span className="sr-only dark:hidden">切换到暗色模式</span>
     <span className="sr-only hidden dark:inline">切换到亮色模式</span>
     ```
     并去掉 button 上的 `aria-label` 属性（让 sr-only 文本承担）。
  2. 或者保留 `aria-label` 但用一个静态合并文本：`"切换深浅色模式"`，省略"目标"信息。

  方案 1 更精确，方案 2 简单。推荐方案 1。
- 同样的处理也用于 rail variant（line 53-71），只是 `<Button variant="dark">` 不变。

### 9.3 `pagination.tsx` 注释陈旧

`src/ui/components/pagination.tsx:86-91` 的注释还在描述早已删除的 `dark:` overrides。改写为：

```tsx
// Pagination chips use the `chip-*` semantic token quartet so the light-mode
// "dark navy chip on white text" and the dark-mode "elevated surface-dim chip
// with ink-1 text" both flow from the .dark / media-query token rebinds in
// tailwind.css. No dark: prefixes on the chipResting class string.
```

或更短：

```tsx
// chip-bg/chip-fg/chip-hover-bg/chip-hover-fg auto-switch via the .dark rebind
// block and the prefers-color-scheme media-query fallback in tailwind.css.
```

### 9.4 验证

- `vp check && vp test run -u && vp build`（snapshot 会因 9.2 微改而需要更新）。
- `vp dev`，浏览器 DevTools：
  1. 清 cookie，打开公开文章页，emulate prefers-color-scheme: dark → 页面应渲染暗色，floating FAB 应显示 Sun 图标，APlayer（如果当前文章带音乐）应显示暗色皮肤。
  2. Disable JavaScript（noscript），重复上面，结果应一致。
  3. 设置 cookie `yf-blog-theme=light`，emulate prefers dark → 页面应渲染浅色（cookie 优先），ThemeToggle 显示 Moon。
  4. 设置 cookie `yf-blog-theme=dark`，emulate prefers light → 页面应渲染暗色（cookie 优先），ThemeToggle 显示 Sun。

---

## Group 10 — 语义一致性

### 10.1 修复 `--ink-2` 在浅色模式下比 `--ink-1` 更深的悖论

`src/assets/styles/tailwind.css:30-31`：

```css
--ink-1: #151b2b;   /* L ≈ 18% */
--ink-2: #151924;   /* L ≈ 14%  ← 比 ink-1 更深，违反"数字 = 视觉强度"约定 */
```

暗色模式下顺序正确（line 166-167：ink-1=#e8e9ea / L93 比 ink-2=#c8ccd6 / L82 更亮）。

**问题**：`--ink-1` 同时是 `--brand-dark` 的值（line 22），改它会影响 `bg-brand-dark` / `text-brand-dark` 的所有使用（Header 社交按钮、QRDialog、search trigger 等）。所以更安全的修复是把 `--ink-2` 改为比 `--ink-1` 略浅的值。

**推荐改动**：

```diff
- --ink-2: #151924;
+ --ink-2: #1f2538;     /* L ≈ 21%, 比 ink-1 #151b2b 的 L 18% 略浅 */
```

或者反向：保留 ink-2 = #151924 但把 ink-1 改深到 `#0f1422`（L ≈ 13%）。但因为 ink-1 也驱动 `--brand-dark` 和文章标题，影响面更大，不推荐。

**视觉 diff**：body 文字会从近黑色变为略带蓝调的深灰。对 OPPO Sans 字体的渲染影响极小，多数人察觉不到。

**风险**：检查 `--ink-2` 在 `--shiki-light` 兜底里的使用（line 257）—— 暗色 shiki 行 inline style 不设值时退回此色。这条逻辑不受影响。

### 10.2 `--warn` / `--alert` 暗色调谐

`tailwind.css:55-56`：

```css
--warn: #ff8338;    /* 橙色 */
--alert: #f7094c;   /* 红色 */
```

均未在 `.dark { }` 或媒体查询块里重绑，5 处消费（CommentItem、CommentReplyForm、PostListViews、DetailBodyChrome）。在暗色 `--surface-body: #1d2842` 上，这两个饱和度高的颜色对比够，但和 `--brand` 在暗色提亮（`#1ab2bd`）的处理不一致。

**推荐改动**（加进 `.dark { }` 和媒体查询块两处）：

```css
--warn: #ff9b5c;    /* 橙色提亮，与 brand lift 对齐 */
--alert: #ff4a6a;   /* 红色提亮 */
```

或者**反向决定**：保持不变并在 `tailwind.css` 加一行注释：

```css
/* warn / alert intentionally mode-agnostic — saturated values read on both surfaces */
```

我倾向于"加亮"方案：与 brand 提亮保持架构一致性。

### 10.3 `--surface-warn` 和 `--warn` 配对一致性

`--surface-warn: #ffe9d5` (light) → `#3a2810` (dark) 已经自动切换，但 `--warn` 不变。配对使用 `bg-surface-warn text-warn` 会得到不同的对比层级。完成 10.2 后自动一致；如果保留 mode-agnostic 决策，则要么 `--surface-warn` 也保持静态，要么显式接受配对漂移。

### 10.4 `--shiki-light` 含义注释

`tailwind.css:257` 和 `:350`：

```css
--shiki-light: var(--ink-2);
```

在 `.dark { }` 里读起来很违和："shiki-light 在 dark 模式下应该是什么？" 答案是"Shiki 输出的 CSS 变量名叫 `--shiki-light`（指浅色主题色槽），我们这里给它一个 dark mode 下的兜底色"。加一行注释：

```css
/* Shiki emits --shiki-light as its light-theme color variable;
   when Shiki's inline style is missing this provides a dark fallback */
--shiki-light: var(--ink-2);
```

注意 CLAUDE.md 的 CSS 注释规则 —— 应在 `.dark { }` 块顶部加单行注释，或干脆把这条声明拎出来放外面单独一节。

### 10.5 验证

- `vp check && vp test run -u && vp build`
- 浏览器 smoke：浅色模式下文章正文文字（默认 `text-ink-2`）应略变浅但仍清晰；评论"删除"链接（`text-alert`）和"举报"等（`text-warn`）在暗色下应有微提亮、可读。

---

## Group 11 — 样式表卫生

### 11.1 合并两个 `@theme inline { }` 块

`tailwind.css:406` 和 `:442` 两个 `@theme inline` 没有语义边界，合并为一个：把 line 442-580 的所有 property 搬进 line 406-439 块的末尾（删除第二个块的开闭大括号即可）。注意把 `@keyframes shake` 和 `comments-shimmer` 一起搬，它们目前在第二个 `@theme inline` 内。

完成后 tailwind.css 只剩一个 `@theme inline` 块。`cn.ts` 的 token 列表无需变化（它只读名字、不读位置）。

### 11.2 `comment-flash` 动画并入 `@theme inline`

`tailwind.css:389-401`：

```css
@keyframes comment-flash { 0%, 25% { … } 100% { … } }
.comment-body.active { animation: comment-flash 3s ease-out forwards; … }
```

迁移到 `@theme inline { }`：

```css
@theme inline {
  /* …其余 token… */
  --animate-comment-flash: comment-flash 3s ease-out forwards;
  @keyframes comment-flash { 0%, 25% { … } 100% { … } }
}
```

把 `.comment-body.active` 留在外部，改写为：

```css
.comment-body.active {
  animation: var(--animate-comment-flash);
  border-radius: var(--radius-sm);
}
```

或者更进一步：在 React 组件里改用 `animate-comment-flash` utility class，删除 `.comment-body.active` 选择器。但需要找到 `comment-body active` 这个状态切换的源头（搜索 `comment-body.*active` / `className.*active` in `CommentItem.tsx`）。如果切换是 imperative DOM 操作（如 hashchange handler 加 class），可能保留 CSS class 选择器更简单。

同步把 `'comment-flash'` 加进 `cn.ts` 的 `ANIMATE_TOKENS`，让契约测试通过。

### 11.3 CSS 注释清理

CLAUDE.md 强制要求："One short ASCII line per region. No special characters or punctuation."

违反的位置（按行号）：
- `tailwind.css:101-104`（`--btn-primary-bg` 上方的多行注释，含 backtick、parens）
- `tailwind.css:172-173`（`--brand` dark 注释）
- `tailwind.css:176`（`--brand-dark` 注释）
- `tailwind.css:183-185`（aside-bg 注释）
- `tailwind.css:191-193`（btn-primary-bg dark 注释）
- `tailwind.css:195-216`（**最长的一段**：暗色 surface L 阶梯说明，21 行带 em-dash 和括号）
- `tailwind.css:240-242`（shadow dark 注释）

**改造策略**：
- 短的（1-3 行）：合并成单行 ASCII 标题，例如 `/* Brand teal lifted */` 替代 `/* Brand teal lifted in dark mode so accents… */`。
- 长的（surface L 阶梯说明，21 行）：这段是教科书级别的设计决策记录，删了可惜。按 CLAUDE.md 指示"Decision-log narrative belongs in commit messages, this file, or a TS/TSX consumer's comment — never in CSS"，搬到 `src/ui/lib/cn.ts` 的"Token system overview"注释块底部，作为新的"Surface lightness ladder"一节。tailwind.css 里只留 `/* Dark surface lightness ladder L 7 to L 44 see cn.ts */`。

收益：tailwind.css 净减 ~50 行，对 Lightning CSS 的潜在崩溃面收缩；cn.ts 成为唯一的设计决策文档源。

### 11.4 cursor base64 抽出到 `cursors.css`

`tailwind.css:633-644` 的两段 base64 PNG（默认指针 + 链接/按钮指针）共 ~10 KB。新建 `src/assets/styles/cursors.css`，搬入这段 `html, body { cursor: …; a, button { cursor: …; } }`，然后在 `tailwind.css` 的对应位置改成：

```css
@import './cursors.css';
```

`html, body { … }` 块的其余规则（font-family、background-color、color、box-sizing 等）留在 `tailwind.css`。

收益：tailwind.css 行数从 1035 降到 ~860；CSS bundle gzip 后预计减 ~3 KB（cursor PNG 是高熵数据，gzip 压不动）。

### 11.5 `text-autospace: normal` 移进 `@layer base`

`tailwind.css:88` 当前在 `:root { }` 顶层声明 `text-autospace: normal;`。按 Tailwind v4 / Skill 推荐放进 `@layer base`：

```css
@layer base {
  :root {
    text-autospace: normal;
  }
  /* ... existing svg / border-color rules ... */
}
```

或者就近合并到现有的 `@layer base { svg { … } *, ::after, … }` 块（line 584-597）。

### 11.6 验证

- `vp check && vp test run -u && vp build`
- 检查 build/client/assets/*.css 文件大小，确认 cursor 抽出后下降。
- 浏览器 smoke：cursor 还能正确显示（最容易忽略的回归点）。

---

## Group 12 — `--ink-on-dark` 双用途文档化

`--ink-on-dark` 当前同时用作：
- 文本色：`text-ink-on-dark`（Button dark variant，line 74 of button.tsx）
- 背景色：`bg-ink-on-dark`（QRDialog dark mode，line 117 of QRDialog.tsx）

后者在暗色模式下强制一个白底，确保 QR 码可被相机识别。命名说"ink"但用作 bg 是 overload。两个选项：

**选项 A（推荐）**：保留单 token，在 `tailwind.css` 加一行注释：

```css
/* --ink-on-dark static near-white used as both text on dark surfaces and forced light background for QR */
--ink-on-dark: #e8e9ea;
```

**选项 B**：分裂为两个 token：
- `--ink-on-dark` 仅文本用
- `--surface-static-light` 给 QR
- 然后改 QRDialog.tsx:117：`bg-ink-on-dark` → `bg-surface-static-light`
- 改 cn.ts 加 `'surface-static-light'`
- 改契约测试如果有 pin

选项 B 更"正确"但只有一处消费，工程上不划算。选 A。

### 12.1 验证

- `vp check`（注释不会影响 build）

---

## Strategic / 后续不在本 Plan 内

下列项目价值高但单 PR 影响面大，建议各自单开 PR 评估：

### S1. `light-dark()` 迁移

把所有 `:root { --foo: X } .dark { --foo: Y } @media (prefers-color-scheme: dark) :root:not(.light, .dark) { --foo: Y }` 三段式折叠为：

```css
:root {
  color-scheme: light dark;
  --foo: light-dark(X, Y);
}
.dark { color-scheme: dark; }
.light { color-scheme: light; }
```

收益：tailwind.css 净减约 150 行，新增 token 时只改一处。

成本：~60 token 的机械重写；浏览器兼容 Chrome 123+ / Firefox 120+ / Safari 17.5+（截至 2026-05-13 均稳定约 24 个月）；需要全面手工测试因为 `light-dark()` 取决于 `color-scheme` 而不是 `.dark` class，行为路径变了。

不要把 S1 和 Groups 9-12 混在一起做。

### S2. 全量 token 改为 OKLCH

把 `:root` 里所有 hex 值改为 `oklch(L C H)`。收益是感知均匀的颜色调整（用 `color-mix(in oklch, var(--brand) X%, white)` 微调任何 token 都得到视觉线性结果）。成本极高，单独评估。

### S3. `cn.ts` token 列表自动生成

用 vite-node 脚本解析 `tailwind.css` 的 `@theme inline` 块、emit `cn.tokens.generated.ts`，替代手维护的 `COLOR_TOKENS` 等数组。契约测试 `tests/contract.tailwind-tokens.test.ts` 已经在 pin 一致性，所以现状不会出问题，但每次加 token 仍要改两个文件。自动化是一次性投资。

### S4. `light-dark()` 不做的话，考虑：契约测试 pin `.dark` 块和媒体查询块 token 名相同

新建 `tests/contract.dark-mode-symmetry.test.ts`，正则提取 `tailwind.css` 内 `.dark { … }` 块和 `@media (prefers-color-scheme: dark) :root:not(.light, .dark) { … }` 块的 property 名列表，断言完全相同。防止单边漂移。这是 S1 之前的廉价保险。

---

## 关键文件清单

| 文件 | Groups |
|---|---|
| `src/assets/styles/aplayer.css` | 9.1 |
| `src/assets/styles/tailwind.css` | 10.1, 10.2, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 12 |
| `src/ui/public/chrome/ThemeToggle.tsx` | 9.2 |
| `src/ui/public/chrome/IconButtonContent.tsx`（可能需要 Read 确认布局） | 9.2 |
| `src/ui/components/pagination.tsx` | 9.3 |
| `src/ui/lib/cn.ts` | 11.2（加 `'comment-flash'`）, 11.3（搬注释） |
| `src/assets/styles/cursors.css`（新建） | 11.4 |
| `tests/contract.boundaries.test.ts` | 9.1（aplayer 镜像断言），S4（如果做） |
| `tests/__snapshots__/*` | 9.2 触发更新（`vp test run -u`） |

## 验证清单

每组结束都跑：
1. `vp check`
2. `vp test run -u`（如果 snapshot 受 9.2 影响）然后 `vp test run`（验证无未提交 snapshot 差异）
3. `vp build`
4. 至少完成 Group 9 后，手动浏览器 smoke：
   - Cookie + JS 三象限（dark cookie / light cookie / no cookie）× 两种 OS 偏好
   - noscript × 两种 OS 偏好（DevTools "Disable JavaScript"）
   - 在含 `<MusicPlayer>` 的文章页验证 aplayer 暗色（9.1）
   - 在公开页右下角 FAB 验证 ThemeToggle 图标随 OS 偏好正确（9.2）

## 顺序与可中断性

- Group 9 必须先做（修 regression）。
- Group 10 / 11 / 12 互相独立，顺序无所谓。
- 每组都是一次完整提交，互不依赖，中途停下问题不大。
- 如果晚上时间有限，最低做完 Group 9 就能下班。
