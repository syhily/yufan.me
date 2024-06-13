import { join } from 'node:path';

import Link from 'next/link';

export function Pagination({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  // No pagination.
  if (current === total && total === 1) {
    return <></>;
  }

  return (
    <nav className="navigation pagination" aria-label="文章">
      <h2 className="screen-reader-text">文章导航</h2>
      <div className="nav-links">
        {total <= 6 ? (
          <SmallPagination current={current} total={total} rootPath={rootPath} />
        ) : (
          <LargePagination current={current} total={total} rootPath={rootPath} />
        )}
      </div>
    </nav>
  );
}

function LargePagination({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  const pages = [];

  if (current < 5) {
    // Trim in the right.
    for (let i = 1; i <= 5; i++) {
      pages.push(<PaginationItem key={i} num={i} current={current} rootPath={rootPath} />);
    }
    pages.push(<PaginationDotItem key={'left-dot'} />);
    pages.push(<PaginationItem key={total} num={total} current={current} rootPath={rootPath} />);
  } else if (current > total - 4) {
    // Trim in the left.
    pages.push(<PaginationItem key={1} num={1} current={current} rootPath={rootPath} />);
    pages.push(<PaginationDotItem key={'right-dot'} />);
    for (let i = total - 4; i <= total; i++) {
      pages.push(<PaginationItem key={i} num={i} current={current} rootPath={rootPath} />);
    }
  } else {
    // Trim in the middle.
    pages.push(<PaginationItem key={1} num={1} current={current} rootPath={rootPath} />);
    pages.push(<PaginationDotItem key={'left-dot'} />);
    for (let i = current - 1; i <= current + 1; i++) {
      pages.push(<PaginationItem key={i} num={i} current={current} rootPath={rootPath} />);
    }
    pages.push(<PaginationDotItem key={'right-dot'} />);
    pages.push(<PaginationItem key={total} num={total} current={current} rootPath={rootPath} />);
  }

  return <>{pages}</>;
}

// Small navigation won't fold the navigation.
function SmallPagination({ current, total, rootPath }: { current: number; total: number; rootPath: string }) {
  const pages = [];
  for (let i = 1; i <= total; i++) {
    pages.push(<PaginationItem key={i} num={i} current={current} rootPath={rootPath} />);
  }

  return <>{pages}</>;
}

function PaginationDotItem() {
  return (
    <span key={'left-dot'} className="page-numbers dots">
      …
    </span>
  );
}

function PaginationItem({ num, current, rootPath }: { num: number; current: number; rootPath: string }) {
  return current !== num ? (
    <Link className={`page-numbers`} href={num === 1 ? rootPath : join(rootPath, `/page/${num}`)}>
      {num}
    </Link>
  ) : (
    <span aria-current="page" className="page-numbers current">
      {num}
    </span>
  );
}
