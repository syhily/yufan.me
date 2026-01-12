<!-- f6e591e3-0a63-4437-85dd-ca31119cd944 4f563203-9dbc-456c-9799-e62ebb15203b -->

# Tailwind CSS 4.1 Migration Plan

## Prerequisites

- Each step produces a visual diff screenshot for comparison
- Test pages (8 total):
  - `/` (home - post list with sidebar)
  - `/posts/youth-buried-in-blogs` (single post with comments)
  - `/categories` (the categories page)
  - `/archives` (archive list)
  - `/about` (personal introduction page)
  - `/links` (friend links page)
  - `/wp-login.php` (admin login form)
  - `/wp-admin` (comment management dashboard)
- Commit after each verified step

## Architecture Overview

```mermaid
flowchart TD
    subgraph current [Current Architecture]
        Bootstrap[bootstrap.css - Single import]
        Reset[reset.css - Variables]
        Globals[globals.css - Components]
    end

    subgraph phase1 [Phase 1: Split Bootstrap]
        BootstrapSCSS[Bootstrap SCSS Modules]
        Grid[grid.scss]
        Utilities[utilities.scss]
        Components[buttons/cards/forms.scss]
    end

    subgraph target [Target Architecture]
        TW4[Tailwind 4.1 via Vite Plugin]
        Theme[@theme - CSS Variables]
        TWUtility[@utility - Custom utilities]
    end

    current --> phase1
    phase1 --> target
```

---

## Phase 0: Add Sass Support & Split Bootstrap

### Step 0.1: Install Sass Support

```shell
npm install -D sass
```

Astro has built-in Sass support, no additional config needed.

- **Test**: Build succeeds

### Step 0.2: Create Bootstrap SCSS Entry File

Create `src/assets/styles/bootstrap.scss` with modular imports:

```scss
// Configuration (required)
@import 'bootstrap/scss/functions';
@import 'bootstrap/scss/variables';
@import 'bootstrap/scss/variables-dark';
@import 'bootstrap/scss/maps';
@import 'bootstrap/scss/mixins';
@import 'bootstrap/scss/root';

// Layout
@import 'bootstrap/scss/reboot';
@import 'bootstrap/scss/containers';
@import 'bootstrap/scss/grid';

// Utilities
@import 'bootstrap/scss/utilities';
@import 'bootstrap/scss/utilities/api';

// Components (only what's actually used)
@import 'bootstrap/scss/buttons';
@import 'bootstrap/scss/card';
@import 'bootstrap/scss/badge';
@import 'bootstrap/scss/forms';
@import 'bootstrap/scss/nav';
@import 'bootstrap/scss/pagination';

// Helpers
@import 'bootstrap/scss/helpers';
```

### Step 0.3: Update globals.css Import

Replace in [globals.css](src/assets/styles/globals.css):

```css
/* Before */
@import 'bootstrap/dist/css/bootstrap.css';

/* After */
@import '@/assets/styles/bootstrap.scss';
```

- **Test**: All 8 pages render identically to before

---

## Phase 1: Foundation Setup (Non-breaking)

### Step 1.1: Install Tailwind CSS 4.1

```shell
npx astro add tailwind
# OR manually:
npm install tailwindcss @tailwindcss/vite
```

Configure Vite plugin in [astro.config.ts](astro.config.ts):

```ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
})
```

- **Test**: Build succeeds, no visual changes

### Step 1.2: Create Tailwind Entry CSS

Create `src/assets/styles/tailwind.css` with @theme block using Tailwind's CSS variable naming conventions:

```css
@import 'tailwindcss';

@theme {
  /* Custom Colors - generates utilities like text-primary, bg-primary */
  --color-primary: #008c95;
  --color-dark: #151b2b;
  --color-secondary: #404b69;
  --color-muted: #8a92a9;
  --color-light: #e8e9ea;
  --color-danger: #f7094c;
  --color-warning: #ff8338;
  --color-body: #151924;

  /* Custom background colors - generates bg-body, bg-card etc */
  --color-bg-body: #fbfbfd;
  --color-bg-light: #f6f6f7;
  --color-bg-muted: #ededf1;
  --color-bg-card: #fff;
  --color-bg-secondary: #283149;

  /* Border colors */
  --color-border-light: #eff3fa;
  --color-border-muted: #d4ddec;

  /* Border radius - generates rounded-xs, rounded-sm etc */
  --radius-xs: 3px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Shadows - generates shadow-xs, shadow-sm etc */
  --shadow-xs: 0 10px 40px 5px rgb(62 61 80 / 2%);
  --shadow-sm: 0 5px 30px 5px rgb(62 61 80 / 5%);
  --shadow-md: 0 10px 40px 5px rgb(62 61 80 / 6%);
  --shadow-lg: 0 10px 40px 5px rgb(62 61 80 / 10%);

  /* Fonts - generates font-sans, font-serif, font-mono */
  --font-sans: 'OPPO Sans 4.0', 'PingFang SC', 'Lantinghei SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'OPPO Serif SC', serif;
  --font-mono: 'Hack', Consolas, Monaco, 'Andale Mono', monospace;
}
```

Import in `globals.css` after Bootstrap SCSS:

```css
@import '@/assets/styles/bootstrap.scss';
@import '@/assets/styles/tailwind.css';
```

- **Test**: Build succeeds, no visual regressions

---

## Phase 2: Migrate Bootstrap Grid → Tailwind

### Step 2.1: Migrate Container

Replace Bootstrap `.container` with Tailwind `container mx-auto px-4` in templates.

Then remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/containers";  // REMOVED
```

- **Test**: Page layouts correct

### Step 2.2: Migrate Grid Columns

Replace Bootstrap grid classes with Tailwind grid/flex:

```html
<!-- Bootstrap row/col -->
<div class="row">
  <div class="col-12 col-md-5">...</div>
  <div class="col-12 col-md-7">...</div>
</div>

<!-- Tailwind grid -->
<div class="grid grid-cols-12 gap-4">
  <div class="col-span-12 md:col-span-5">...</div>
  <div class="col-span-12 md:col-span-7">...</div>
</div>

<!-- OR Tailwind flex -->
<div class="flex flex-wrap">
  <div class="w-full md:w-5/12">...</div>
  <div class="w-full md:w-7/12">...</div>
</div>
```

Then remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/grid";  // REMOVED
```

- **Test**: Post list, sidebar layouts correct

---

## Phase 3: Migrate Bootstrap Utilities → Tailwind

### Step 3.1: Migrate Display Utilities

Replace in templates:

- `d-none` → `hidden`
- `d-block` → `block`
- `d-flex` → `flex`
- `d-inline-block` → `inline-block`
- `d-md-block` → `md:block`
- `d-xl-block` → `xl:block`
- `d-none d-md-block` → `hidden md:block`

- **Test**: Responsive visibility works

### Step 3.2: Migrate Flex Utilities

Replace in templates:

- `flex-fill` → `flex-1`
- `flex-column` → `flex-col`
- `align-items-center` → `items-center`
- `justify-content-center` → `justify-center`
- `justify-content-between` → `justify-between`
- `flex-wrap` → `flex-wrap`

- **Test**: Flex layouts correct

### Step 3.3: Migrate Spacing Utilities

Bootstrap and Tailwind spacing scales differ. Map carefully:

- Bootstrap `mt-3` (1rem) → Tailwind `mt-4` (1rem)
- Bootstrap `p-4` (1.5rem) → Tailwind `p-6` (1.5rem)

Then remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/utilities";      // REMOVED
// @import "bootstrap/scss/utilities/api";  // REMOVED
```

- **Test**: All spacing correct

---

## Phase 4: Migrate Bootstrap Components → Tailwind

### Step 4.1: Migrate Buttons

Define with `@utility` in `tailwind.css`:

```css
@utility btn {
  border-radius: var(--radius-xs);
  font-size: 0.875rem;
  padding: 0.5rem 1.625rem;
  white-space: normal;
  transition: all 0.15s linear;
}

@utility btn-primary {
  color: #fff;
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

@utility btn-primary:hover {
  background-color: var(--color-dark);
  border-color: var(--color-dark);
}
```

Remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/buttons";  // REMOVED
```

- **Test**: All buttons render correctly

### Step 4.2: Migrate Cards

Define card utilities with `@utility`, remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/card";  // REMOVED
```

- **Test**: Post cards, sidebar blocks correct

### Step 4.3: Migrate Badges

Define badge utilities with `@utility`, remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/badge";  // REMOVED
```

- **Test**: Category badges correct

### Step 4.4: Migrate Forms

Define form utilities with `@utility`, remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/forms";  // REMOVED
```

- **Test**: Search, comment form, login form correct

### Step 4.5: Migrate Navigation

Define nav utilities with `@utility`, remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/nav";  // REMOVED
```

- **Test**: Site navigation correct

### Step 4.6: Migrate Pagination

Define pagination utilities with `@utility`, remove from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/pagination";  // REMOVED
```

- **Test**: Post list pagination correct

---

## Phase 5: Migrate Custom CSS → Tailwind

### Step 5.1: Migrate Custom Square Size Utilities

Add to `tailwind.css` using `@utility` (these set both width AND height):

```css
@utility size-8 {
  width: 8px;
  height: 8px;
}
@utility size-12 {
  width: 12px;
  height: 12px;
}
@utility size-16 {
  width: 16px;
  height: 16px;
}
@utility size-20 {
  width: 20px;
  height: 20px;
}
@utility size-24 {
  width: 24px;
  height: 24px;
}
@utility size-28 {
  width: 28px;
  height: 28px;
}
@utility size-32 {
  width: 32px;
  height: 32px;
}
@utility size-36 {
  width: 36px;
  height: 36px;
}
@utility size-40 {
  width: 40px;
  height: 40px;
}
@utility size-48 {
  width: 48px;
  height: 48px;
}
@utility size-56 {
  width: 56px;
  height: 56px;
}
@utility size-64 {
  width: 64px;
  height: 64px;
}
@utility size-72 {
  width: 72px;
  height: 72px;
}
@utility size-80 {
  width: 80px;
  height: 80px;
}
@utility size-96 {
  width: 96px;
  height: 96px;
}
@utility size-128 {
  width: 128px;
  height: 128px;
}
```

Update templates: `.w-40` → `size-40`

Remove `.w-*` custom sizes from `globals.css`.

- **Test**: Avatars, icons correct

### Step 5.2: Migrate Text Size Utilities

Custom text sizes with `@utility`:

```css
@utility text-xx {
  font-size: 0.6875rem;
}
/* text-xs, text-sm already exist in Tailwind with different values */
/* Use custom names to avoid conflicts */
@utility text-size-xs {
  font-size: 0.75rem;
}
@utility text-size-sm {
  font-size: 0.875rem;
}
@utility text-size-md {
  font-size: 0.9375rem;
}
@utility text-size-lg {
  font-size: 1.125rem;
}
@utility text-size-xl {
  font-size: 1.625rem;
}
```

Or use Tailwind's built-in text sizes and adjust where needed.

Remove from `globals.css`.

- **Test**: Typography correct

### Step 5.3: Migrate Line Clamp Utilities

Use Tailwind's built-in `line-clamp-*` utilities:

```html
<!-- Before -->
<div class="h-1x">...</div>
<div class="h-2x">...</div>
<div class="h-3x">...</div>

<!-- After (Tailwind built-in) -->
<div class="line-clamp-1">...</div>
<div class="line-clamp-2">...</div>
<div class="line-clamp-3">...</div>
```

Remove `.h-1x`, `.h-2x`, `.h-3x` from `globals.css`.

- **Test**: Text truncation correct

### Step 5.4: Migrate Layout Components

Migrate `.site-layout`, `.site-aside`, `.site-main`, `.sidebar-inner`, etc.

- **Test**: Overall layout correct

### Step 5.5: Migrate Remaining Components

Migrate `.media-*`, `.list-*`, `.comment-*`, `.widget-*`, etc.

- **Test**: All components correct

---

## Phase 6: Dark Mode Migration

### Step 6.1: Enable Tailwind Dark Mode

Add to `tailwind.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Update JS to toggle `dark` class on `<html>` element instead of `.nice-dark-mode`.

- **Test**: Dark mode toggle works

### Step 6.2: Migrate Night Variables

Add dark theme colors to `@theme`:

```css
@theme {
  /* ... existing colors ... */

  /* Dark mode colors */
  --color-dark-primary: #008c95;
  --color-dark-body: #e4e4e5;
  --color-dark-bg-body: #19191d;
  --color-dark-bg-light: #232327;
  --color-dark-bg-muted: #202023;
  --color-dark-border-light: #3f4041;
  --color-dark-border-muted: #37373c;
}
```

Update components with `dark:` variants:

```html
<div class="bg-bg-body dark:bg-dark-bg-body text-body dark:text-dark-body">...</div>
```

Remove `.nice-dark-mode` rules from CSS.

- **Test**: Full dark mode visual comparison on all 8 pages

---

## Phase 7: Final Cleanup

### Step 7.1: Remove Bootstrap Completely

Remove remaining Bootstrap imports from `bootstrap.scss`:

```scss
// @import "bootstrap/scss/functions";     // REMOVED
// @import "bootstrap/scss/variables";     // REMOVED
// @import "bootstrap/scss/variables-dark"; // REMOVED
// @import "bootstrap/scss/maps";          // REMOVED
// @import "bootstrap/scss/mixins";        // REMOVED
// @import "bootstrap/scss/root";          // REMOVED
// @import "bootstrap/scss/reboot";        // REMOVED
// @import "bootstrap/scss/helpers";       // REMOVED
```

Delete `bootstrap.scss` file.

Remove Bootstrap import from `globals.css`.

```shell
npm uninstall bootstrap
```

- **Test**: All 8 pages render correctly

### Step 7.2: Remove Sass

```shell
npm uninstall sass
```

Ensure no `.scss` files remain.

- **Test**: Build succeeds

### Step 7.3: Consolidate CSS Files

- Move all remaining custom styles to Tailwind layers or `@utility`
- Simplify `globals.css` to only import `tailwind.css` and third-party CSS
- Move cursor styles from `reset.css` to `tailwind.css`

- **Test**: CSS bundle size reduced

### Step 7.4: Final Verification

- Full visual regression on all 8 test pages
- Update AGENTS.md documentation to reflect Tailwind CSS usage

---

## Key Tailwind 4 Syntax Reference

| Feature | Syntax |

|---------|--------|

| Import | `@import "tailwindcss";` |

| Theme variables | `@theme { --color-primary: #008c95; }` |

| Custom utility | `@utility btn { ... }` |

| Dark mode | `@custom-variant dark (&:where(.dark, .dark *));` |

| CSS var in class | `bg-(--brand-color)` |

| CSS var in CSS | `var(--color-primary)` |

---

## Files to Modify

| File | Changes |

|------|---------|

| `package.json` | Add sass (temp), tailwindcss/@tailwindcss/vite, remove bootstrap & sass at end |

| `astro.config.ts` | Add Tailwind Vite plugin |

| `src/assets/styles/bootstrap.scss` | New (temp) - Modular Bootstrap imports |

| `src/assets/styles/tailwind.css` | New - Tailwind entry with @theme and @utility |

| `src/assets/styles/globals.css` | Update imports, gradual reduction |

| `src/assets/styles/reset.css` | Keep cursor styles only, move variables to @theme |

| `src/layouts/*.astro` | Update class names |

| `src/components/**/*.astro` | Update class names |

---

## Success Criteria

- Zero visual regression on all 8 test pages
- CSS bundle size reduced or equal
- Build time acceptable
- Dark mode works with Tailwind's `dark:` variant
- No Bootstrap or Sass dependencies remaining

### To-dos

- [ ] Phase 1: Install Tailwind 4.1, configure Vite plugin, create theme CSS
- [ ] Phase 2: Migrate utility classes (colors, sizes, spacing)
- [ ] Phase 3: Replace Bootstrap grid with Tailwind flex/grid
- [ ] Phase 4: Migrate component classes (buttons, cards, forms)
- [ ] Phase 5: Migrate layout components (nav, sidebar, pagination)
- [ ] Phase 6: Implement Tailwind dark mode with class strategy
- [ ] Phase 7: Remove Bootstrap, consolidate CSS, final testing
