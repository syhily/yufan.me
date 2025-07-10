<!-- markdownlint-disable MD001 MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/blog-poster.png">
</picture>

# Yufan Personal Weblog

This is the source code of [yufan.me](https://yufan.me).

## History

The source code has evolved through four stages.

- Initially, it was built on WordPress in 2011.
- In 2017, the blog switched to Hexo and converted all the blog posts to Markdown.
- By 2024, the blog had been rewritten using Next.js with App Router.
- Currently, the blog has transitioned to Astro.

## Core Components

- [Node.js](https://nodejs.org): The latest Node.js LTS
- [Astro](https://astro.build): Core engine
- [Postgres](https://zeabur.com/docs/marketplace/postgresql): Comments, likes and users
- [Redis](https://zeabur.com/docs/marketplace/redis): User session store
- [Zeabur](https://zeabur.com?referralCode=syhily&utm_source=syhily): Host service

## Local Development

You can fork and clone this project for your own use. But do so at your own risk.
The project uses Docker compose for development. Run it locally with command:

```bash
docker compose up
```

If you want to start the Astro in VSCode and use Docker for database and cache.
You can use the command below.

```bash
cp .env.docker .env
docker compose -f docker-compose-local.yml up
```

## Writing

All the posts should be placed in `src/content/posts` directory with MDX format.
All the pages should be placed in `src/content/pages` directory with MDX format.
You can add any scripts or other customizable features by leveraging the MDX.

### Front Matter

Front-matter is a block of YAML at the beginning of the file that is used to configure settings for your writings.
Front-matter is terminated by three dashes when written in YAML.

```yaml
---
title: Hello World
date: 2013/7/13 20:46:25
---
```

### Post Front Matter Settings

| Setting     | Description                               | Required | Default              |
| ----------- | ----------------------------------------- | -------- | -------------------- |
| `slug`      | ID (unique), used as the permalink        | true     |                      |
| `title`     | Title                                     | true     |                      |
| `date`      | Published date                            | true     |                      |
| `updated`   | Updated date                              | false    | Published date       |
| `comments`  | Enables comment feature for the post      | false    | `true`               |
| `tags`      | Tags                                      | false    | `null`               |
| `category`  | Category                                  | true     | `null`               |
| `summary`   | Post summary in plain text                | false    | First 140 characters |
| `cover`     | The cover image                           | false    | `null`               |
| `og`        | The open graph                            | false    | `null`               |
| `published` | Whether the post should be published      | false    | `true`               |
| `visible`   | Can the post be displayed on the homepage | false    | `true`               |
| `toc`       | Display the Table of Contents             | false    | `false`              |
| `alias`     | The alternatives slugs for post           | false    | `[]`                 |

### Pages Front Matter Settings

| Setting     | Description                          | Required | Default              |
| ----------- | ------------------------------------ | -------- | -------------------- |
| `slug`      | ID (unique), used as the permalink   | true     |                      |
| `title`     | Title                                | true     |                      |
| `date`      | Published date                       | true     |                      |
| `updated`   | Updated date                         | false    | Published date       |
| `comments`  | Enables comment feature for the page | false    | `true`               |
| `summary`   | Page summary in plain text           | false    | First 140 characters |
| `cover`     | The cover image                      | false    | `null`               |
| `og`        | The open graph                       | false    | `null`               |
| `published` | Whether the page should be published | false    | `true`               |
| `toc`       | Display the Table of Contents        | false    | `false`              |

## Weblog Design

Almost all the design resources are placed in the file [yufan.me.sketch](docs/yufan.me.sketch).
I mainly use the [Sketch](https://www.sketch.com) as my design tools.

The favicon is almost the same as the weblog logo. The main different is that we simplify the elements used in logo.
Pick up the main park from the logo and change the dot color for readability in small icon.
The background color is included in the exported favicon.
That is because we want to make sure it could be viewed clearly in any browser.

The size of the favicon is following this
[tutorial](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)
to get it worked everywhere.

## Deploy the Weblog

This weblog is deployed on the [zeabur](https://zeabur.com) platform.
You can check their documents and get your own weblog to be published without any budget at first.

Or you can host on your own machine. Use [Dockerfile](./Dockerfile) to build an image and run it locally.

## TODOs

- [ ] Add last modified time component for post.
- [ ] Slide share components integration.
- [ ] Check article grammar errors by using AI. Remain **42** posts.
- [ ] Add music to the articles. Remain **42** posts.

## License

The source code of this blog is licensed under the [MIT](LICENSE) license,
feel to free to use it without any legal risks.

The [content](src/content) of this blog's posts is licensed under the
[CC BY-NC-SA 4.0](src/content/LICENSE) license.

### Logo Fonts License

The fonts used in weblog logo is [M+A1](https://booth.pm/ja/items/2347968) with [license](licenses/LICENSE.m-plus.txt),
[UnGungseo](https://kldp.net/unfonts) with [license](licenses/LICENSE.un-fonts.txt),
and [Iroha Mochi](https://modi.jpn.org/font_iroha-mochi.php) with [license](licenses/LICENSE.iroha-mochi.txt).

They are the fonts that can be used in business without any charge.

### Open Graph Font License

The [OPPOSans 4.0](https://open.oppomobile.com/new/developmentDoc/info?id=13223)
is used for rendering the open graph image in my weblog with [license](licenses/LICENSE.opposans.txt)

### Third Party Codes License

Some codes in this project are copied from other projects. I have added the comments in the files' header.

The source codes used from third party projects are:

- [seo.ts](src/helpers/seo.ts)
  from [flexdinesh/blogster](https://github.com/flexdinesh/blogster/blob/main/packages/shared/src/seo.ts)
  with [license](licenses/LICENSE.flexdinesh.txt)
- [og.ts](src/helpers/og.ts)
  from [yuaanlin/yual.in](https://github.com/yuaanlin/yual.in/blob/main/pages/og_image/%5Bslug%5D.tsx)
  with [permission](licenses/LICENSE.yuaanlin.jpg)
- [images.ts](src/helpers/images.ts)
  and [config.ts](src/content/config.ts)
  from [zce/velite](https://github.com/zce/velite/blob/main/src/assets.ts)
  with [license](licenses/LICENSE.zce.txt)
- [images.ts](src/helpers/images.ts)
  from [vercel/next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/image-blur-svg.ts)
  with [license](licenses/LICENSE.vercel.txt)
- [photoswipe-slideshow.js](src/assets/scripts/photoswipe-slideshow.js)
  from [junkfix/photoswipe-slideshow](https://github.com/junkfix/photoswipe-slideshow)
  with [license](licenses/LICENSE.junkfix.txt)
