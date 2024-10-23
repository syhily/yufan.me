<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/poster/github-poster-dark.png">
  <img alt="Yufan Blog Logo" src="docs/poster/github-poster.png">
</picture>

# Yufan Personal Weblog

This is a personal weblog for [Yufan Sheng](https://github.com/syhily)
which is built on [Astro](https://astro.build) and hosted on [zeabur](https://zeabur.com).

[![Deployed on Zeabur](https://zeabur.com/deployed-on-zeabur-dark.svg)](https://zeabur.com?referralCode=syhily&utm_source=syhily)

## History

The blog's source code has evolved through four stages. Initially, it was built on WordPress in 2011.
In 2017, I switched to Hexo and converted all my blog posts to Markdown;
the code is available in the [Hexo branch](https://github.com/syhily/yufan.me/tree/hexo).
By 2024, the blog had been rewritten using Next.js with App Router;
you can find this version in the [Next branch](https://github.com/syhily/yufan.me/tree/next).
Currently, the blog has transitioned to Astro, which is located in
the [Astro branch](https://github.com/syhily/yufan.me/tree/astro).

## Core Frameworks

- [Node.js](https://nodejs.org): The latest Node.js LTS
- [Astro](https://astro.build): Core engine
- [Artalk](https://artalk.js.org): The self-hosted comment system
- [Fuse.js](https://www.fusejs.io): Search engine
- [Postgres](https://zeabur.com/docs/marketplace/postgresql): The view counter and like button for all my posts

## Local Development

You can fork and clone this project for your own use. But do so at your own risk.

The project uses npm for development. Run it locally with these commands:

```shell
# Install the dependencies by using bun.
npm install

# Init git hooks.
npx husky

# Check the newer dependencies.
npm update

# Start local development with a live preview. The weblog is hosted on http://localhost:4321
npm run dev
```

### Postgres Database

This blog uses Postgres to store post views and favorites. For security reasons,
the configuration isn't defined in the `.env` file.
Modify the `.env.example` file and rename it to `.env` for local development.

You can create a Postgres database by installing [Postgres.app](https://postgresapp.com).
The default username is `your system username`, with no password.

Create and initialize the database and user with these commands:

```postgresql
-- Create a database.
CREATE DATABASE <db>;

-- Create a user.
CREATE USER <db_user> PASSWORD '<strong_password>';

-- Grant the connection.
GRANT CONNECT ON DATABASE <db> TO <db_user>;

-- Grant the database privilege.
GRANT ALL PRIVILEGES ON DATABASE <db> TO <db_user>;

-- If you are using Postgres 15 or above.
-- Switch to the created database and execute SQL.
GRANT ALL ON SCHEMA public TO <db_user>;
```

Most tables are created by the Artalk. [Execute the Artalk](https://artalk.js.org/guide/deploy.html) to create the
tables.

The like table should be created manually. Execute the SQL below.

```postgresql
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS atk_likes_id_seq;

-- Table Definition
CREATE TABLE "public"."atk_likes"
(
    "id"         int8 NOT NULL DEFAULT nextval('atk_likes_id_seq'::regclass),
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    "token"      varchar(255),
    "page_key"   varchar(255),
    PRIMARY KEY ("id")
);

-- Create table index
CREATE INDEX IF NOT EXISTS "idx_atk_likes_token" ON "public"."atk_likes" ("token");
```

### Comments Integration

This weblog uses artalk as its backend comment service. But since artalk didn't provide the latest comments API.
We decide to query it directly from the Postgres database. So the comments and fav clicks are living in the same
database.

### S3 Compatible Storage Integration

This blog will upload all the built resources at build stage. You can remove this feature by removing the
`uploader` integration in `astro.config.ts`.

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

| Setting     | Description                          | Required | Default              |
|-------------|--------------------------------------|----------|----------------------|
| `id`        | ID (unique), used as the permalink   | true     | Filename             |
| `title`     | Title                                | true     | Filename             |
| `date`      | Published date                       | true     |                      |
| `updated`   | Updated date                         | false    | Published date       |
| `comments`  | Enables comment feature for the post | false    | `true`               |
| `tags`      | Tags                                 | false    | `null`               |
| `category`  | Category                             | true     | `null`               |
| `summary`   | Post summary in plain text           | false    | First 140 characters |
| `cover`     | The cover image                      | false    | `null`               |
| `published` | Whether the post should be published | false    | `true`               |

### Pages Front Matter Settings

| Setting     | Description                          | Required | Default        |
|-------------|--------------------------------------|----------|----------------|
| `id`        | ID (unique), used as the permalink   | true     | Filename       |
| `title`     | Title                                | true     | Filename       |
| `date`      | Published date                       | true     |                |
| `updated`   | Updated date                         | false    | Published date |
| `comments`  | Enables comment feature for the post | false    | `true`         |
| `cover`     | The cover image                      | false    | `null`         |
| `published` | Whether the post should be published | false    | `true`         |

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

The comment system is leverage the [Artalk](https://artalk.js.org), a self-hosted comment system.
You should host it on your own machine.

## Short-Term TODO Checklist

- [ ] Add clickable toc support for post.
- [ ] Add last modified time component for post.
- [ ] Add light box for images.
- [ ] Move comments into the new Astro content layer.
- [ ] Check article grammar errors by using ChatGPT. Remain **42** posts.
- [ ] Add music to the articles. Remain **42** posts.

## Long-Term TODO Checklist

- [ ] Use self-developed comment solution.
  - [ ] Support modification after commenting in 60 minutes even if you have refreshed the page.
  - [ ] Support login into the blog for managing the comments.
- [ ] Slide share components integration.
- [ ] Add han.js support for better typography.
- [ ] Drop bootstrap, in favor of tailwind css.

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

### Open Graph Font & Web Font License

The [OPPOSans 4.0](https://open.oppomobile.com/new/developmentDoc/info?id=13223)
is used for rendering the open graph image in my weblog.
We also use it as the main web font for articles.
It can be used in business scenarios without any modification.
The license file is [here](licenses/LICENSE.opposans.txt)

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
