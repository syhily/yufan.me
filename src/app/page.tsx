import { ListPosts } from '@/components/post/list';
import { posts, tags } from '#site/content';

export default function Page() {
  return <ListPosts posts={posts} pageNum={1} tags={tags} />;
}
