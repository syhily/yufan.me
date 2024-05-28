import { db } from '@/helpers/db/pool';
import { atk_comments, atk_pages, atk_users } from '@/helpers/db/schema';
import { options } from '@/helpers/schema';
import { desc, eq, notInArray, sql } from 'drizzle-orm';

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

export const increaseLikes = async (permalink: string): Promise<number> => {
  const pageKey = `${options.website + permalink}/`;
  await db
    .update(atk_pages)
    .set({
      vote_up: sql`${atk_pages.vote_up} + 1`,
    })
    .where(eq(atk_pages.key, sql`${pageKey}`));

  return await queryLikes(permalink);
};

export const queryLikes = async (permalink: string): Promise<number> => {
  const pageKey = `${options.website + permalink}/`;
  const results = await db
    .select({ like: atk_pages.vote_up })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? results[0].like ?? 0 : 0;
};

export const queryLikesAndViews = async (permalink: string): Promise<[number, number]> => {
  const pageKey = `${options.website + permalink}/`;
  const results = await db
    .select({ like: atk_pages.vote_up, view: atk_pages.pv })
    .from(atk_pages)
    .where(eq(atk_pages.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0];
};
