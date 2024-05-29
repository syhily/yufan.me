import { db } from '@/helpers/db/pool';
import { atk_comments, atk_likes, atk_pages, atk_users } from '@/helpers/db/schema';
import { makeToken } from '@/helpers/nanoid';
import { options } from '@/helpers/schema';
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
    .where(notInArray(atk_comments.user_id, options.settings.comments.admins))
    .orderBy(desc(atk_comments.created_at))
    .limit(options.settings.sidebar.comment);

  return results.map(({ title, author, authorLink, page, id }) => {
    let trimTitle = title ?? '';
    if (trimTitle.includes(` - ${options.title}`)) {
      trimTitle = trimTitle.substring(0, trimTitle.indexOf(` - ${options.title}`));
    }
    return {
      title: trimTitle,
      author: author ?? '',
      authorLink: authorLink ?? '',
      permalink: `${page}#atk-comment-${id}`,
    };
  });
};

const generateKey = (slug: string): string => `${options.website}/posts/${slug}/`;

export const increaseLikes = async (slug: string): Promise<{ likes: number; token: string }> => {
  const pageKey = generateKey(slug);
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

  return { likes: await queryLikes(slug), token: token };
};

export const decreaseLikes = async (slug: string, token: string) => {
  const pageKey = generateKey(slug);
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

export const queryLikes = async (slug: string): Promise<number> => {
  const pageKey = generateKey(slug);
  const results = await db
    .select({ like: atk_pages.vote_up })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? results[0].like ?? 0 : 0;
};

export const queryLikesAndViews = async (slug: string): Promise<[number, number]> => {
  const pageKey = generateKey(slug);
  const results = await db
    .select({ like: atk_pages.vote_up, view: atk_pages.pv })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0];
};
