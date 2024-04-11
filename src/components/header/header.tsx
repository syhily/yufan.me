'use client';
import Link from 'next/link';
import { useState } from 'react';

import { Logo, LogoLarge } from '@/components/header/logo';
import { Nav } from '@/components/header/nav';
import { QRDialog } from '@/components/qrcode/qrocode';
import { Search } from '@/components/search/search';
import { options } from '#site/content';

export default function Header() {
  const [show, setShow] = useState(false);
  const links = options.socials.map((social) => {
    if (social.type === 'qrcode') {
      return (
        <QRDialog
          key={social.icon}
          url={social.link}
          name={social.name}
          title={social.title ?? social.name}
          icon={social.icon}
        />
      );
    } else {
      return (
        <Link
          key={social.icon}
          href={social.link}
          target={'_blank'}
          title={social.title ?? social.name}
          className="btn btn-dark btn-icon btn-circle button-social"
        >
          <span>
            <i className={`iconfont ${social.icon}`}></i>
          </span>
        </Link>
      );
    }
  });

  return (
    <>
      {/* Change to use options.socials */}
      <header className={`site-aside ${show ? 'in' : ''}`}>
        <div className="aside-overlay" onClick={() => setShow(false)}></div>
        <div className="aside-inner bg-secondary">
          <h1 className="navbar-brand">
            <Link href={'/'} title={options.title} className="d-block">
              <Logo />
            </Link>
          </h1>
          <Nav click={() => setShow(false)} />
          <div className="site-submenu">
            {links}
            <Search />
          </div>
        </div>
      </header>
      <div className="mobile-brand">
        <div className="container">
          <div className="d-flex flex-flex align-items-center">
            <Link href={'/'} title={options.title} className="d-block">
              <LogoLarge />
            </Link>
            <div className="flex-fill"></div>
            <div className="menu-toggler text-xl" onClick={() => setShow(true)}>
              <i className="d-block iconfont icon-menu"></i>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
