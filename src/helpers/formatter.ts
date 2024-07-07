import type { Post } from '@/helpers/schema';
import options from '@/options';
import { DateTime } from 'luxon';

export const slicePosts = (
  posts: Post[],
  pageNum: number,
  pageSize: number,
): { currentPosts: Post[]; totalPage: number } => {
  const totalPage = Math.ceil(posts.length / pageSize);
  if (totalPage >= pageNum) {
    return {
      currentPosts:
        pageNum === totalPage
          ? posts.slice((pageNum - 1) * pageSize)
          : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
      totalPage,
    };
  }
  return { currentPosts: [], totalPage: 0 };
};

export const formatShowDate = (date: Date) => {
  const source = date ? +new Date(date) : +new Date();
  const now = +new Date();
  const diff = now - source > 0 ? now - source : 60 * 1000;
  const oneSeconds = 1000;
  const oneMinute = oneSeconds * 60;
  const oneHour = oneMinute * 60;
  const oneDay = oneHour * 24;
  const oneWeek = oneDay * 7;
  const oneMonth = oneDay * 30;
  const oneYear = oneDay * 365;

  // Formatter for different types of date.
  if (diff < oneDay) {
    return '今天';
  }
  if (diff < oneWeek) {
    return `${Math.floor(diff / oneDay)} 天前`;
  }
  if (diff < oneMonth) {
    return `${Math.floor(diff / oneWeek)} 周前`;
  }
  if (diff < oneYear) {
    const months = Math.floor(diff / oneMonth);
    if (months > 0) {
      return `${months} 月前`;
    }
  }

  const years = Math.floor(diff / oneYear);
  if (years > 0 && years < 3) {
    return `${years} 年前`;
  }

  // Format the post's date with time zone support.
  return DateTime.fromJSDate(date)
    .setZone(options.settings.timeZone)
    .setLocale(options.settings.locale)
    .toFormat(options.settings.timeFormat);
};

export const formatLocalDate = (source: string) => {
  const date = new Date(source);
  return DateTime.fromJSDate(date)
    .setZone(options.settings.timeZone)
    .setLocale(options.settings.locale)
    .toFormat(options.settings.timeFormat);
};
