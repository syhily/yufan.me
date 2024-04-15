'use client';
import React, { useEffect, useState } from 'react';

export function GoTop() {
  const [top, setTop] = useState(false);

  const handleVisibleButton = () => {
    setTop(window.scrollY > 300);
  };

  const handleScrollUp = () => {
    window.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    window.addEventListener('scroll', handleVisibleButton);
  }, []);

  return (
    <ul className="site-fixed-widget">
      <li className={`fixed-gotop ${top ? 'current' : ''}`} onClick={handleScrollUp}>
        <div className="btn btn-light btn-icon btn-lg btn-rounded btn-gotop">
          <span>
            <i className="iconfont icon-arrowup"></i>
          </span>
        </div>
      </li>
    </ul>
  );
}
