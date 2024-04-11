import { categories, Category } from '#site/content';

export function QueryCategory({ name, slug }: { name?: string; slug?: string }): Category | undefined {
  return categories.find((c) => c.name === name || c.slug === slug);
}
