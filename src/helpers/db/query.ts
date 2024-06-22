import { db } from '@/helpers/db/pool';
import { atk_comments, atk_likes, atk_pages, atk_users } from '@/helpers/db/schema';
import { makeToken, urlJoin } from '@/helpers/tools';
import options from '@/options';
import { and, desc, eq, isNull, notInArray, sql } from 'drizzle-orm';

export interface Comment {
  title: string;
  author: string;
  authorLink: string;
  permalink: string;
}

export const latestComments = async (): Promise<Comment[]> => {
  const results = await db
    .select({
      id: atk_comments.id,
      page: atk_comments.page_key,
      title: atk_pages.title,
      author: atk_users.name,
      authorLink: atk_users.link,
    })
    .from(atk_comments)
    .leftJoin(atk_pages, eq(atk_comments.page_key, atk_pages.key))
    .leftJoin(atk_users, eq(atk_comments.user_id, atk_users.id))
    .where(and(notInArray(atk_comments.user_id, options.settings.comments.admins), eq(atk_comments.is_pending, false)))
    .orderBy(desc(atk_comments.created_at))
    .limit(options.settings.sidebar.comment);

  return results.map(({ title, author, authorLink, page, id }) => {
    let trimTitle = title ?? '';
    if (trimTitle.includes(` - ${options.title}`)) {
      trimTitle = trimTitle.substring(0, trimTitle.indexOf(` - ${options.title}`));
    }

    const link = !options.isProd() && page !== null ? page.replace(options.website, import.meta.env.SITE) : page;

    return {
      title: trimTitle,
      author: author ?? '',
      authorLink: authorLink ?? '',
      permalink: `${link}#atk-comment-${id}`,
    };
  });
};

export const increaseViews = async (pageKey: string) => {
  await db
    .update(atk_pages)
    .set({
      pv: sql`${atk_pages.pv} + 1`,
    })
    .where(eq(atk_pages.key, sql`${pageKey}`));
};

const generatePageKey = (permalink: string): string => urlJoin(options.website, permalink, '/');

export const increaseLikes = async (permalink: string): Promise<{ likes: number; token: string }> => {
  const pageKey = generatePageKey(permalink);
  const token = makeToken(250);
  // Save the token
  await db.insert(atk_likes).values({
    token: token,
    page_key: pageKey,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Bump the likes
  await db
    .update(atk_pages)
    .set({
      vote_up: sql`${atk_pages.vote_up} + 1`,
    })
    .where(eq(atk_pages.key, sql`${pageKey}`));

  return { likes: await queryLikes(permalink), token: token };
};

export const decreaseLikes = async (permalink: string, token: string) => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ id: atk_likes.id })
    .from(atk_likes)
    .where(and(eq(atk_likes.token, token), eq(atk_likes.page_key, pageKey), isNull(atk_likes.deleted_at)))
    .limit(1);

  // No need to dislike
  if (results.length <= 0) {
    return;
  }

  const id = results[0].id;
  // Remove the token
  await db
    .update(atk_likes)
    .set({
      updated_at: new Date(),
      deleted_at: new Date(),
    })
    .where(eq(atk_likes.id, id));
  // Decrease the likes
  await db
    .update(atk_pages)
    .set({
      vote_up: sql`${atk_pages.vote_up} - 1`,
    })
    .where(eq(atk_pages.key, sql`${pageKey}`));
};

export const queryLikes = async (permalink: string): Promise<number> => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ like: atk_pages.vote_up })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? results[0].like ?? 0 : 0;
};

export const queryLikesAndViews = async (permalink: string): Promise<[number, number]> => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ like: atk_pages.vote_up, view: atk_pages.pv })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0];
};
