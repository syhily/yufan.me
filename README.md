<!-- markdownlint-disable MD001 MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/images/blog-poster.png">
</picture>

# Yufan Personal Blog

[![Folo](https://badge.folo.is/feed/54772566650461214?color=FF5C00&labelColor=black&style=flat-square)](https://app.folo.is/share/feeds/54772566650461214) ![Astro](https://astro.badg.es/v2/built-with-astro/tiny.svg) [![Deployed on Zeabur](./licenses/zeabur.svg)](https://zeabur.com/referral?referralCode=syhily&utm_source=syhily)

This is the source code for [yufan.me](https://yufan.me).

## History

The source code has gone through four major stages:

- Initially, it was built with WordPress in 2011.
- In 2017, the blog migrated to Hexo, and all posts were converted to Markdown.
- By 2024, the blog was completely rewritten using Next.js with the App Router.
- Currently, it has transitioned to Astro.

## Local Development

The blog’s configuration is managed by the `.env` file.
Use the commands below to set up and run a local instance.

```bash
cp .env.example .env
npm i
npm run dev
```

### Debugging with break points

If you want to debug using breakpoints, open the project in VSCode and run the development server directly within it.

## Writing

All posts should be placed in the `src/content/posts` directory in MDX format.
All static pages should be placed in the `src/content/pages` directory, also in MDX format.
You can include custom scripts or components by leveraging MDX capabilities.

### Front Matter

Front Matter is a YAML block at the top of a file used to configure settings for your writing.
It is enclosed by triple dashes.

```yaml
---
title: Hello World
date: 2013/7/13 20:46:25
---
```

### Post Front Matter Settings

| Setting     | Description                                                 | Required | Default              |
| ----------- | ----------------------------------------------------------- | -------- | -------------------- |
| `slug`      | Unique ID, used as the permalink                            | true     |                      |
| `title`     | Title of the post                                           | true     |                      |
| `date`      | Publication date. Future dates will be treated as scheduled | true     |                      |
| `updated`   | Last updated date                                           | false    | Published date       |
| `comments`  | Enable comments for the post                                | false    | `true`               |
| `tags`      | Tags associated with the post                               | false    | `null`               |
| `category`  | Category of the post                                        | true     | `null`               |
| `summary`   | Post summary in plain text                                  | false    | First 140 characters |
| `cover`     | Cover image                                                 | false    | `null`               |
| `og`        | Open Graph image                                            | false    | `null`               |
| `published` | Whether the post is published                               | false    | `true`               |
| `visible`   | Whether the post appears in feeds                           | false    | `true`               |
| `toc`       | Display the Table of Contents                               | false    | `false`              |
| `alias`     | Alternative slugs for the post                              | false    | `[]`                 |

### Pages Front Matter Settings

| Setting     | Description                      | Required | Default              |
| ----------- | -------------------------------- | -------- | -------------------- |
| `slug`      | Unique ID, used as the permalink | true     |                      |
| `title`     | Title of the page                | true     |                      |
| `date`      | Publication date                 | true     |                      |
| `updated`   | Last updated date                | false    | Published date       |
| `comments`  | Enable comments for the page     | false    | `true`               |
| `summary`   | Page summary in plain text       | false    | First 140 characters |
| `cover`     | Cover image                      | false    | `null`               |
| `og`        | Open Graph image                 | false    | `null`               |
| `published` | Whether the page is published    | false    | `true`               |
| `toc`       | Display the Table of Contents    | false    | `false`              |

## Blog Design

The favicon closely resembles the blog logo, with simplified elements for better readability at smaller sizes.
It retains the main shape from the logo but adjusts the dot color for visibility.
The background color is embedded in the exported favicon to ensure clear display across all browsers.

The favicon sizing follows this
[tutorial](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)
to ensure compatibility across platforms.

## Deploy the Blog

This blog is deployed on the [zeabur](https://zeabur.com) platform.
You can check their documentation and deploy your own blog for free initially.

Alternatively, you can self-host it.
Use the provided [Dockerfile](./Dockerfile) to build an image and run it locally.

## License

The source code of this blog is licensed under the [MIT](LICENSE) license, feel free to use it without legal risk.

The [content](src/content) of this blog's posts is licensed under the
[CC BY-NC-SA 4.0](src/content/LICENSE) license.

### Logo Fonts License

- [M+A1](https://booth.pm/ja/items/2347968)([license](licenses/LICENSE.m-plus.txt))
- [UnGungseo](https://kldp.net/unfonts)([license](licenses/LICENSE.un-fonts.txt))
- [Iroha Mochi](https://modi.jpn.org/font_iroha-mochi.php)([license](licenses/LICENSE.iroha-mochi.txt))

All of these fonts are free for commercial use.

### Web Font License

- [OPPOSans 4.0](https://open.oppomobile.com/new/developmentDoc/info?id=13223)([license](licenses/LICENSE.opposans.txt))
- [OPPOSerif](https://open.oppomobile.com/new/developmentDoc/info?id=13223)([license](licenses/LICENSE.opposans.txt))
- [Hack](https://github.com/source-foundry/Hack)([license](licenses/LICENSE.hack.txt))

### Open Graph Font License

- [NoteSans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)([license](licenses/LICENSE.notosans.txt))

### Third Party Codes License

Some code in this project was adapted from other open-source projects.
Relevant credits and license information are included in the source file headers.
