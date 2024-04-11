import { ListPosts } from '@/components/page/post';
import { posts, tags } from '#site/content';

export default function Page() {
  return <ListPosts posts={posts} pageNum={1} tags={tags} />;
}
