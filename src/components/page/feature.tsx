import Image from 'next/image';
import Link from 'next/link';

import { options, Post } from '#site/content';

export function FeaturePosts({ posts }: { posts: Post[] }) {
  const featurePosts = options.settings.post.feature ?? [];
  const metas: Post[] = featurePosts
    .map((slug) => posts.find((post) => post.slug === slug))
    .flatMap((post) => (post == null ? [] : [post]))
    .slice(0, 3);

  return (
    <div className="list-top-pushes mb-3 mb-md-4 mb-lg-5">
      <div className="container">
        <div className="row gx-2 gx-md-3 list-grouped">
          <div className="col-lg-8">
            <FeaturePost post={metas[0]} />
          </div>
          <div className="col-lg-4 d-flex flex-column mt-2 mt-md-3 mt-lg-0">
            <div className="row g-2 g-md-3">
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[1]} />
              </div>
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[2]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePost({ post }: { post: Post; first?: boolean }) {
  return (
    <div className="list-item list-nice-overlay" key={post.slug}>
      <div className="media media-3x2">
        <Link href={post.permalink} className={'media-content'}>
          <Image
            src={post.cover.src}
            width={post.cover.width}
            height={post.cover.height}
            placeholder="blur"
            blurDataURL={post.cover.blurDataURL}
            alt={post.title}
          />
          <div className="overlay"></div>
        </Link>
      </div>
      <div className="list-content p-2 p-md-3">
        <div className="list-body">
          <Link href={post.permalink} className="list-title h5 h-2x m-0">
            {post.title}
          </Link>
        </div>
      </div>
    </div>
  );
}
