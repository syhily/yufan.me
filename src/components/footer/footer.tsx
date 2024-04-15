import { DateTime } from 'luxon';
import Link from 'next/link';

import { options } from '#site/content';

function currentYear(): number {
  return DateTime.now().setZone(options.settings.timeZone).year;
}

export function Footer() {
  return (
    <footer className="border-top border-light text-xs text-center py-4 py-xl-5">
      Copyright © {options.settings.initialYear}-{currentYear()}{' '}
      <Link href={options.website} title={options.title} rel="home">
        {options.title}
      </Link>
      <br />
      <Link href="https://beian.miit.gov.cn" rel="nofollow" target="_blank" title={'良民证'}>
        {options.settings.icpNo}
      </Link>
    </footer>
  );
}
