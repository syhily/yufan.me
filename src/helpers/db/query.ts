import { db } from '@/helpers/db/pool';
import { atk_comments, atk_pages, atk_users } from '@/helpers/db/schema';
import { options } from '@/helpers/schema';
import { desc, eq, notInArray } from 'drizzle-orm';

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

// export async function increaseLikes(permalink: string) {
//   const pageKey = options.website + permalink + '/';
//   const sql = `UPDATE ${table('pages')}
//                SET vote_up = vote_up + 1
//                WHERE ${column('pages', '`key`')} = ?;`;

//   await pool.query(mysql.format(sql), [pageKey]);
//   return queryLikes(permalink);
// }

// export async function queryLikes(permalink: string): Promise<number> {
//   noStore();

//   const pageKey = options.website + permalink + '/';
//   const sql = `SELECT vote_up
//                FROM ${table('pages')}
//                WHERE ${column('pages', '`key`')} = ?
//                LIMIT 1;`;
//   const [rows] = await pool.query<RowDataPacket[]>(mysql.format(sql), [pageKey]);

//   return rows.length > 0 ? rows[0]['vote_up'] : 0;
// }

// export async function queryLikesAndViews(permalink: string): Promise<[number, number]> {
//   noStore();

//   const pageKey = options.website + permalink + '/';
//   const sql = `SELECT vote_up, pv
//                FROM ${table('pages')}
//                WHERE ${column('pages', '`key`')} = ?
//                LIMIT 1`;
//   const [rows] = await pool.query<RowDataPacket[]>(mysql.format(sql), [pageKey]);

//   return rows.length > 0 ? [rows[0]['vote_up'], rows[0]['pv']] : [0, 0];
// }
