![yufan.me](docs/poster/github-poster.png#gh-light-mode-only)
![yufan.me](docs/poster/github-poster-dark.png#gh-dark-mode-only)

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
Currently, the blog has transitioned to Astro, which is located in the [Astro branch](https://github.com/syhily/yufan.me/tree/astro).

## Core Frameworks

- [Node.js](https://nodejs.org): The latest Node.js LTS
- [Astro](https://astro.build): Core engine
- [Artalk](https://artalk.js.org): The self-hosted comment system
- [Fuse.js](https://www.fusejs.io): Search engine
- [Postgres](https://zeabur.com/docs/marketplace/postgresql): The view counter and like button for all my posts

## Local Development

This weblog is still under [development](#todo-checklist). Many ideas and thoughts are in my checklists.
You can fork and clone this project for your own use. But do so at your own risk.

### Postgres Database

This blog uses Postgres to store post views and favorites. For security reasons,
the configuration isn't defined in the `.env` file.
Modify the `.env.example` file and rename it to `.env` for local development.

You can create a Postgres database by installing [Postgres.app](https://postgresapp.com).
The default username is `your system username`, with no password.

Create and initialize the database and user with these commands:

```shell
# Create a database.
psql -c "CREATE DATABASE <db>"

# Create a user.
psql -c "CREATE USER <db_user> PASSWORD '<StrongPassword!>'"

# Grant the connection.
psql -c "GRANT CONNECT ON DATABASE <db> TO <db_user>"

# Grant the database privilege.
psql -c "GRANT ALL PRIVILEGES ON DATABASE <db> TO <db_user>"
```

The project uses npm for development. Run it locally with these commands:

```shell
# Install the dependencies by using bun.
npm install

# Check the newer dependencies.
npm update

# Start local development with a live preview. The weblog is hosted on http://localhost:4321
npm run dev
```

### Comments Integration

This weblog use artalk as its backend comment service. But since artalk didn't provide the latest comments API.
We decide to query it directly from Postgres database. So the comments and fav clicks are living in the same database.

## HTTP Request Routes

This weblog HTTP request routes keeps the same as my original weblog.
I just list here for comprehension.
You can change it as you personal needs.

- `/` - List the lasted posts and pinged posts on top of it.
  - `/api/likes` - Like button.
  - `/page/{number}` - List the posts by the page number.
  - `/cats/{slug}` - List all the posts in this category. Posts can belong to only one category.
    - `/cats/{slug}/page/{number}` - List the posts in the given category by the page number.
  - `/tags/{slug}` - List the posts under this tag.
    - `/tags/{slug}/page/{number}` - List the posts under this tag with page number.
  - `/links` - A special endpoint for listing all the friends' website.
  - `/feed` - The subscribing page for display the xml.
  - `/posts/{slug}` - Shw the article.
  - `/{slug}` - Show the page. The pages don't belong to any categories nor tags.

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
| ----------- | ------------------------------------ | -------- | -------------------- |
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
| ----------- | ------------------------------------ | -------- | -------------- |
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

### Logo

The fonts used in weblog logo is [M+A1](https://booth.pm/ja/items/2347968) with [license](licenses/LICENSE.m-plus),
[UnGungseo](https://kldp.net/unfonts) with [license](licenses/LICENSE.un-fonts),
and [Iroha Mochi](https://modi.jpn.org/font_iroha-mochi.php) with [license](licenses/LICENSE.iroha-mochi).

They are the fonts that can be used in business without any charge.

### Favicon

The favicon is almost the same as the weblog logo. The main different is that we simplify the elements used in logo.
Pick up the main park from the logo and change the dot color for readability in small icon.
The background color is included in the exported favicon.
That is because we want to make sure it could be viewed clearly in any browser.

The size of the favicon is following this
[tutorial](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)
to get it worked everywhere.

### Article Fonts

The [OPPOSans 3.0](https://www.coloros.com/article/A00000050) is used for reading in my weblog.
It can be used in business scenarios without any modification.
Since we can't provide 3rd-party download link by the license limitation,
we have to reference this font by using OPPO's internal link.
The license file is [here](licenses/LICENSE.oppo-sans)

## Deploy the Weblog

This weblog is deployed on the [zeabur](https://zeabur.com) platform.
You can check their documents and get your own weblog to be published without any budget at first.

Or you can host on your own machine.
Use the [pm2](https://pm2.keymetrics.io) to have a long-running process without an exit.

The comment system is leverage the [Artalk](https://artalk.js.org), a self-hosted comment system.
You should host it on your own machine.
But it can be modified and changed to any other comment solutions.
For instance, the [giscus](https://giscus.app) is an opinionated choice.

## TODO Checklist

- [ ] Add image lazy load support with blur background.
- [ ] Add Open Graph for all my pages.
- [ ] Add like icon with deduplication.
- [ ] Artalk integration with custom stylesheet.
- [ ] Add recent comments.
- [ ] Add cover for all my posts. Remain **79** posts.
- [ ] Slide share components integration.

### Long Term Goals

- [ ] Add han.js support for better typography.
- [ ] Drop bootstrap, in favor of tailwind css.
- [ ] Use self developed duoshuo as the comments solution.

## License

The source code of this blog is licensed under the [MIT](LICENSE) license,
feel to free to use it without any legal risks.

The [content](src/content) of this blog's posts is licensed under the
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

### Third Party Codes

Some codes in this project is copied from other project.
I have add the comments in the file header and keep these license file in [licenses](licenses) directory.
