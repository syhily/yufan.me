import mysql, { RowDataPacket } from 'mysql2/promise';
import { unstable_noStore as noStore } from 'next/cache';

import { options } from '#site/content';

const connectionConfig = {
  host: process.env.MYSQL_HOST as string,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.ARTALK_DATABASE as string,
  user: process.env.MYSQL_USERNAME as string,
  password: process.env.MYSQL_PASSWORD as string,
  prefix: process.env.ARTALK_TABLE_PREFIX as string,
};

export const pool: mysql.Pool = mysql.createPool({
  connectionLimit: 20,
  maxIdle: 10,
  enableKeepAlive: true,
  host: connectionConfig.host,
  port: connectionConfig.port,
  user: connectionConfig.user,
  password: connectionConfig.password,
  database: connectionConfig.database,
});

export interface Comment {
  title: string;
  author: string;
  permalink: string;
}

export async function latestComments(): Promise<Comment[]> {
  noStore();

  const commentTable = connectionConfig.prefix + 'comments';
  const pageTable = connectionConfig.prefix + 'pages';
  const authorTable = connectionConfig.prefix + 'users';

  const comments: Comment[] = [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${commentTable + '.id'}       as id,
            ${commentTable + '.page_key'} as href,
            ${pageTable + '.title'}       as title,
            ${authorTable + '.name'}      as author
     from ${commentTable}
            LEFT JOIN ${pageTable} ON ${commentTable + '.page_key'} = ${pageTable + '.key'}
            LEFT JOIN ${authorTable} ON ${commentTable + '.user_id'} = ${authorTable + '.id'}
     ORDER BY ${commentTable + '.created_at'} DESC
     LIMIT ${options.settings.sidebar.comment};`,
  );

  // Construct comments.
  rows.forEach((result) => {
    const title = result['title'];
    comments.push({
      title: title.substring(0, title.indexOf(' - ')),
      author: result['author'],
      // https://yufan.me/posts/about-hefei/#atk-comment-7834
      permalink: result['href'] + '#atk-comment-' + result['id'],
    });
  });

  return comments;
}

export async function increaseLikes(permalink: string) {
  const pageKey = options.website + permalink + '/';
  const pageTable = connectionConfig.prefix + 'pages';
  const sql = 'UPDATE ' + pageTable + ' SET vote_up = vote_up + 1 WHERE `key` = ? LIMIT 1;';

  await pool.query(sql, [pageKey]);
  return queryLikes(permalink);
}

export async function queryLikes(permalink: string): Promise<number> {
  const pageKey = options.website + permalink + '/';
  const pageTable = connectionConfig.prefix + 'pages';
  const sql = 'SELECT vote_up FROM ' + pageTable + ' WHERE `key` = ? LIMIT 1;';
  const [rows] = await pool.query<RowDataPacket[]>(sql, [pageKey]);

  return rows.length > 0 ? rows[0]['vote_up'] : 0;
}

export async function queryLikesAndViews(permalink: string): Promise<[number, number]> {
  const pageKey = options.website + permalink + '/';
  const pageTable = connectionConfig.prefix + 'pages';
  const sql = 'SELECT vote_up, pv FROM ' + pageTable + ' WHERE `key` = ? LIMIT 1;';
  const [rows] = await pool.query<RowDataPacket[]>(sql, [pageKey]);

  return rows.length > 0 ? [rows[0]['vote_up'], rows[0]['pv']] : [0, 0];
}
