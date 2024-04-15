import 'bootstrap/dist/css/bootstrap.min.css';
import '@/styles/reset.css';
import '@/styles/globals.css';
import '@/styles/iconfont/iconfont.css';

import type { Metadata } from 'next';
import React from 'react';

import { Footer } from '@/components/footer/footer';
import { GoTop } from '@/components/footer/gotop';
import Header from '@/components/header/header';
import { options } from '#site/content';

// Metadata is a replacement for the next/head.
export const metadata: Metadata = {
  title: {
    default: `${options.title} - ${options.description}`,
    template: `%s - ${options.title}`,
  },
  description: options.description,
  keywords: options.keywords,
  applicationName: 'My Blog',
  authors: { name: options.author.name, url: options.author.url },
  generator: 'Next.js',
  publisher: 'Vercel',
  icons: [
    {
      url: '/favicon.ico',
      rel: 'icon',
      sizes: '32x32',
    },
    {
      url: '/favicon.svg',
      rel: 'icon',
      type: 'image/svg+xml',
    },
    {
      url: '/apple-touch-icon.png',
      rel: 'apple-touch-icon',
    },
    {
      url: '/manifest.webmanifest',
      rel: 'manifest',
    },
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: options.title,
    description: options.description,
    type: 'article',
    url: options.website,
    images: [
      {
        url: `${options.website}/images/open-graph.png`,
      },
    ],
  },
  twitter: {
    title: options.title,
    card: 'summary_large_image',
    description: options.description,
    images: `${options.website}/images/open-graph.png`,
  },
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed', title: `${options.title} &raquo; Feed` }],
    },
  },
};

/**
 * The main endpoint for my weblog. It's the main part of my weblog which is shared by all the pages.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={options.settings.locale}>
      <body className={`home blog`}>
        <div className={'site-layout'}>
          <Header />
          <main className="site-main">
            {children}
            <Footer />
          </main>
          <GoTop />
        </div>
      </body>
    </html>
  );
}
