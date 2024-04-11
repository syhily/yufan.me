// Props for post, page, tag, category.
type SlugProps = Readonly<{
  params: { slug: string };
}>;

// Props for the page query of tag, category.
type SlugPaginationProps = Readonly<{
  params: { slug: string; pagination: string | number };
}>;

// Props for the page query of posts.
type PostPaginationProps = Readonly<{
  params: { pagination: string | number };
}>;

type SearchProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};
