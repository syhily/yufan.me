import { Tag, tags } from '#site/content';

export function QueryTag({ name, slug }: { name?: string; slug?: string }): Tag | undefined {
  return tags.find((tag) => tag.name === name || tag.slug === slug);
}
