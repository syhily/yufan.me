# AGENTS.md - Project Guidelines for AI Assistants

## Project Overview

This is **yufan.me**, a personal blog built with **Astro 5.x** framework. The blog uses server-side rendering (SSR) with Node.js adapter and features a content-driven architecture with MDX support for posts and pages.

- **Website**: https://yufan.me
- **Framework**: Astro 5.16+ with SSR (`output: 'server'`)
- **Language**: TypeScript (strict mode)
- **Styling**: Bootstrap 5.3+ with Pure CSS (no preprocessors)
- **Content**: MDX format for posts and pages
- **Database**: PostgreSQL via Drizzle ORM
- **Session**: Redis
- **Deployment**: Zeabur (Docker-based)

## Directory Structure

```
src/
├── actions/            # Astro server actions (auth, comments)
├── assets/
│   ├── fonts/          # Custom fonts (OPPO Sans, OPPO Serif, Hack, iconfont)
│   ├── scripts/        # Client-side JavaScript (vanilla JS)
│   └── styles/         # CSS files (globals.css, reset.css, admin.css)
├── components/         # Astro components (.astro files)
│   ├── comment/        # Comment system components
│   ├── like/           # Like/share functionality
│   ├── mdx/            # MDX-specific components (music, solutions)
│   ├── meta/           # SEO meta components
│   ├── page/           # Page-related (pagination, posts, toc)
│   ├── partial/        # Layout partials (Header, Footer, etc.)
│   ├── search/         # Search functionality
│   └── sidebar/        # Sidebar widgets
├── content/            # Content collections (MDX files)
│   ├── metas/          # YAML configs (categories.yml, tags.yml, friends.yml)
│   ├── pages/          # Static pages (about, guestbook, links)
│   └── posts/          # Blog posts organized by year
├── helpers/            # Utility functions organized by domain
│   ├── auth/           # Authentication (CSRF, session, user)
│   ├── comment/        # Comment data handling
│   ├── content/        # Content processing (markdown, render, schema)
│   ├── db/             # Database (Drizzle schema, pool)
│   ├── email/          # Email sending (Mailgun templates)
│   ├── images/         # Image processing (OG images, calendar)
│   └── php/            # PHP WASM runtime (honeypot feature)
├── layouts/            # Page layouts
│   ├── BaseLayout.astro    # Root layout with HTML head
│   ├── PageLayout.astro    # Static pages layout
│   ├── PostLayout.astro    # Blog post layout
│   └── posts/              # Archive/category/tag layouts
├── pages/              # File-based routing
├── blog.config.ts      # Blog configuration
├── content.config.ts   # Content collections schema
└── middleware.ts       # Request middleware (auth, redirects)
```

## Technology Stack

### Core Dependencies

- `astro` - Framework (v5.16+)
- `@astrojs/mdx` - MDX support
- `@astrojs/node` - SSR adapter
- `drizzle-orm` + `pg` - Database ORM
- `ioredis` - Redis client for sessions
- `shiki` - Syntax highlighting
- `marked` - Markdown parsing
- `sharp` - Image processing
- `@napi-rs/canvas` - Canvas for OG image generation

### Styling Dependencies

- `bootstrap` - CSS framework (v5.3+)
- Custom CSS variables system (no Sass/Less)

## Code Conventions

### TypeScript

- Strict mode enabled
- Path aliases: `@/*` → `./src/*`, `~/*` → `./public/*`
- Use type imports: `import type { X } from 'module'`
- Interfaces for data shapes, types for unions/utilities

### Astro Components

- Use `.astro` extension for components
- Props interface defined in frontmatter
- Minimal client-side JavaScript (prefer vanilla JS)
- Use `Astro.props` for component props

```astro
---
interface Props {
  title: string
  showFooter?: boolean
}
const { title, showFooter = true } = Astro.props
---

<div>{title}</div>
```

### CSS Conventions

- **CSS Variables**: Defined in `src/assets/styles/reset.css`
  - Colors: `--color-primary`, `--color-dark`, `--color-secondary`, etc.
  - Backgrounds: `--bg-primary`, `--bg-light`, `--bg-body`, etc.
  - Buttons: `--btn-primary`, `--btn-secondary`, etc.
  - Borders: `--border-primary`, `--border-light`, etc.
  - Radius: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`
  - Night mode variables prefixed with `--night-*`

- **Font Families**:
  - Body: `'OPPO Sans 4.0'` with fallbacks
  - Serif: `'OPPO Serif SC'` for post content
  - Code: `'Hack', Consolas, Monaco, monospace`

- **Bootstrap Usage**:
  - Grid system: `container`, `row`, `col-*`
  - Utilities: `d-flex`, `d-none`, `d-lg-block`, etc.
  - Responsive: `*-sm`, `*-md`, `*-lg`, `*-xl`, `*-xxl`

- **Custom Classes**:
  - Text sizes: `.text-xs`, `.text-sm`, `.text-md`, `.text-lg`, `.text-xl`
  - Widths: `.w-24`, `.w-32`, `.w-40`, etc.
  - Line clamp: `.h-1x`, `.h-2x`, `.h-3x`
  - Cards: `.card`, `.card-md`, `.card-body`
  - Lists: `.list`, `.list-item`, `.list-grid`
  - Media: `.media`, `.media-16x9`, `.media-content`

### Content Collections

- **Posts**: `src/content/posts/{year}/*.mdx`
- **Pages**: `src/content/pages/*.mdx`
- **Schema**: Defined in `src/content.config.ts` using Zod

#### Post Frontmatter

```yaml
---
title: Post Title (required)
date: 2024-01-01 (required)
category: Category Name (required)
tags: [tag1, tag2] (optional)
summary: Plain text summary (optional)
cover: https://url/to/image (optional)
og: /path/to/og-image (optional)
published: true (optional, default: true)
visible: true (optional, default: true)
toc: false (optional, default: false)
alias: [old-slug] (optional)
comments: true (optional, default: true)
---
```

### Server Actions

- Located in `src/actions/`
- Export via `src/actions/index.ts`
- Use Astro's `defineAction` from `astro:actions`

### Middleware

- Authentication checks for `/wp-admin/*` routes
- URL redirects for old post slugs
- Apache honeypot headers (security feature)

## Database

### Schema Location

- `src/helpers/db/schema.ts` - Drizzle table definitions
- `drizzle/` - Migration files

### Migrations

- SQL files in `drizzle/` directory
- Named: `0000_init_schema.sql`, `0001_...`, etc.

## Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `MAILGUN_API_KEY` - Email service (optional)
- `MAILGUN_DOMAIN` - Email domain (optional)
- `S3_*` - Asset storage (optional)

## Development Commands

```bash
npm run dev       # Start dev server (port 4321)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint + Astro check
npm run lint:fix  # Auto-fix lint issues
```

## Key Files to Know

| File                            | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `src/blog.config.ts`            | Site configuration (title, navigation, socials, settings) |
| `src/content.config.ts`         | Content collection schemas                                |
| `src/middleware.ts`             | Request middleware                                        |
| `src/helpers/content/schema.ts` | Content type definitions and queries                      |
| `src/assets/styles/reset.css`   | CSS variables and base styles                             |
| `src/assets/styles/globals.css` | Component styles (Bootstrap imports here)                 |
| `src/layouts/BaseLayout.astro`  | Root HTML layout                                          |
| `astro.config.ts`               | Astro configuration                                       |

## Important Patterns

### Fetching Posts

```typescript
import { getPost, getPosts } from '@/helpers/content/schema'

// Get all visible posts
const posts = getPosts({ hidden: false, schedule: false })

// Get single post by slug
const post = getPost('my-post-slug')
```

### Using Blog Config

```typescript
import config from '@/blog.config'

const siteTitle = config.title
const navigation = config.navigation
```

### Image Handling

- Use Astro's `Image` component for optimization
- OG images generated via `@napi-rs/canvas`
- Assets can be uploaded to S3 via `astro-uploader`

## Localization

- Primary language: Chinese (zh-CN)
- Timezone: Asia/Shanghai
- Date format: `yyyy-MM-dd` (configurable in `blog.config.ts`)
- Chinese font support with custom fonts

## Notes for AI Assistants

1. **Preserve existing style**: This project uses pure CSS with Bootstrap utilities. Don't introduce CSS preprocessors.

2. **Component structure**: Follow the existing pattern of Astro components with TypeScript frontmatter.

3. **Content safety**: Posts in `src/content/` are under CC BY-NC-SA 4.0 license.

4. **SSR-aware**: The site runs in SSR mode. Be mindful of server vs client code boundaries.

5. **Minimal JS**: The project prefers vanilla JavaScript over frameworks for client-side code.

6. **Chinese content**: Many UI strings and content are in Chinese. Maintain consistency.

7. **Responsive design**: Always consider mobile, tablet, and desktop breakpoints using Bootstrap's responsive classes.

8. **Performance**: Image optimization, code splitting, and asset prefixing are configured. Maintain these optimizations.
