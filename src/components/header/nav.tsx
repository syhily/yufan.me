import Link from 'next/link';
import { MouseEventHandler } from 'react';

import { options } from '#site/content';

export function Nav({ click }: { click: MouseEventHandler }) {
  const links = options.navigation.map((menu, i) => (
    <li onClick={click} key={i} id={`menu-item-${i}`} className={`menu-item ${i == 0 ? 'menu-item-home}' : ''}`}>
      <Link href={menu.link} target={menu.target}>
        {menu.text}
      </Link>
    </li>
  ));

  return (
    <div className="site-menu">
      <ul>{links}</ul>
    </div>
  );
}
