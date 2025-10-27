import React, { useEffect } from 'react';

type MetaProps = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  keywords?: string;
};

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}='${name}']`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function Meta({ title, description, url, image, keywords }: MetaProps) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) upsertMeta('description', description);
    if (keywords) upsertMeta('keywords', keywords);
    if (url) upsertMeta('og:url', url, 'property');
    if (title) upsertMeta('og:title', title, 'property');
    if (description) upsertMeta('og:description', description, 'property');
    if (image) upsertMeta('og:image', image, 'property');
    // Twitter
    if (title) upsertMeta('twitter:title', title);
    if (description) upsertMeta('twitter:description', description);
    if (image) upsertMeta('twitter:image', image);

    return () => {
      // restore previous title (keep meta tags as defaults)
      document.title = prevTitle;
    };
  }, [title, description, url, image, keywords]);

  return null;
}
