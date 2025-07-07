import { db } from '@/helpers/db/pool';
import { comment, like, page, user } from '@/helpers/db/schema';
import { makeToken, urlJoin } from '@/helpers/tools';
import options from '@/options';
import { and, desc, eq, inArray, isNull, sql, type InferSelectModel } from 'drizzle-orm';

export interface Comment {
  title: string;
  author: string;
  authorLink: string;
  permalink: string;
}

export const queryUser = async (email: string): Promise<InferSelectModel<typeof user> | null> => {
  const results = await db
    .select()
    .from(user)
    .where(eq(user.email, sql`${email}`));
  if (results.length === 0) {
    return null;
  }

  return results[0];
};

export const queryEmail = async (id: number): Promise<string | null> => {
  const results = await db
    .select({
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, sql`${id}`))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  return results[0].email;
};

export const queryUserId = async (email: string): Promise<string | null> => {
  const results = await db
    .select({
      id: user.id,
    })
    .from(user)
    .where(eq(user.email, sql`${email}`))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  return results[0].id;
};

export const latestComments = async (): Promise<Comment[]> => {
  const latestDistinctCommentsQuery = sql`SELECT    id
FROM      (
          SELECT    id,
                    user_id,
                    created_at,
                    ROW_NUMBER() OVER (
                    PARTITION BY user_id
                    ORDER BY  created_at DESC
                    ) rn
          FROM      comment
          WHERE     user_id != 3
          AND       is_pending = FALSE
          ) AS most_recent
WHERE     rn = 1
ORDER BY  created_at DESC
LIMIT     ${options.settings.sidebar.comment}`;

  const latestDistinctComments = (await db.execute(latestDistinctCommentsQuery)).rows
    .map((row) => row.id)
    .map((id) => BigInt(`${id}`));

  const results = await db
    .selectDistinctOn([comment.id], {
      id: comment.id,
      page: comment.pageKey,
      title: page.title,
      author: user.name,
      authorLink: user.website,
    })
    .from(comment)
    .innerJoin(page, eq(comment.pageKey, page.key))
    .innerJoin(user, eq(comment.userId, user.id))
    .where(inArray(comment.id, latestDistinctComments))
    .orderBy(desc(comment.id))
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

const generatePageKey = (permalink: string): string => urlJoin(options.website, permalink, '/');

export const increaseLikes = async (permalink: string): Promise<{ like: number; token: string }> => {
  const pageKey = generatePageKey(permalink);
  const token = makeToken(250);
  // Save the token
  await db.insert(like).values({
    token: token,
    pageKey: pageKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Bump the like
  await db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} + 1`,
    })
    .where(eq(page.key, sql`${pageKey}`));

  return { like: await queryLikes(permalink), token: token };
};

export const decreaseLikes = async (permalink: string, token: string) => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey), isNull(like.deletedAt)))
    .limit(1);

  // No need to dislike
  if (results.length <= 0) {
    return;
  }

  const id = results[0].id;
  // Remove the token
  await db
    .update(like)
    .set({
      updatedAt: new Date(),
      deletedAt: new Date(),
    })
    .where(eq(like.id, id));
  // Decrease the like
  await db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} - 1`,
    })
    .where(eq(page.key, sql`${pageKey}`));
};

export const queryLikes = async (permalink: string): Promise<number> => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ like: page.voteUp })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? (results[0].like ?? 0) : 0;
};

export const queryLikesAndViews = async (permalink: string): Promise<[number, number]> => {
  const pageKey = generatePageKey(permalink);
  const results = await db
    .select({ like: page.voteUp, view: page.pv })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1);

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0];
};
