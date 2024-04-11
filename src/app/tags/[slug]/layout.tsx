import React from 'react';

export default function PageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">{children}</div>;
}
