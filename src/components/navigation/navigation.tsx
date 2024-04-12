import path from 'node:path';

import Link from 'next/link';

const useSmallNavigation = 5;

export function Navigation({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  if (current === total && total === 1) {
    return <></>;
  }

  return (
    <nav className="navigation pagination" aria-label="文章">
      <h2 className="screen-reader-text">文章导航</h2>
      <div className="nav-links">
        {total <= useSmallNavigation ? (
          <SmallNavigation current={current} total={total} rootPath={rootPath} />
        ) : (
          <LargeNavigation current={current} total={total} rootPath={rootPath} />
        )}
      </div>
    </nav>
  );
}

function LargeNavigation({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  const pages = [];

  // Trim left.
  if (current < 4) {
    for (let i = 0; i < current - 1; i++) {
      pages.push(<NavigationItem key={i} index={i} current={current} rootPath={rootPath} />);
    }
  } else {
    pages.push(<NavigationItem key={1} index={0} current={current} rootPath={rootPath} />);
    pages.push(
      <span key={'left-dot'} className="page-numbers dots">
        …
      </span>,
    );
    pages.push(<NavigationItem key={current - 1} index={current - 2} current={current} rootPath={rootPath} />);
  }

  // Add Current
  pages.push(<NavigationItem key={current} index={current - 1} current={current} rootPath={rootPath} />);

  // Trim right.
  if (current + 3 > total) {
    for (let i = current; i < total; i++) {
      pages.push(<NavigationItem key={current + 1} index={i} current={current} rootPath={rootPath} />);
    }
  } else {
    pages.push(<NavigationItem key={current + 1} index={current} current={current} rootPath={rootPath} />);
    pages.push(
      <span key={'right-dot'} className="page-numbers dots">
        …
      </span>,
    );
    pages.push(<NavigationItem key={total} index={total - 1} current={current} rootPath={rootPath} />);
  }

  return <>{pages}</>;
}

// Small navigation won't show the previous or next page button.
function SmallNavigation({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  const pages = [];
  for (let i = 0; i < total; i++) {
    pages.push(<NavigationItem key={i + 1} index={i} current={current} rootPath={rootPath} />);
  }

  return <>{pages}</>;
}

function NavigationItem({ index, current, rootPath }: { index: number; current: number; rootPath: string }) {
  return current !== index + 1 ? (
    <Link className={`page-numbers`} href={index === 0 ? rootPath : path.join(rootPath, `/page/${index + 1}`)}>
      {index + 1}
    </Link>
  ) : (
    <span aria-current="page" className="page-numbers current">
      {index + 1}
    </span>
  );
}
