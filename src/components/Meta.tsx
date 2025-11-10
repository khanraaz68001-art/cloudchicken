import React from 'react';
import { Helmet } from 'react-helmet-async';

type MetaProps = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  keywords?: string;
};

export default function Meta({ title, description, url, image, keywords }: MetaProps) {
  const canonical = url || typeof window !== 'undefined' ? (window.location.origin + window.location.pathname + (window.location.search || '')) : undefined;

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Open Graph */}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {/* Canonical */}
      {canonical && <link rel="canonical" href={canonical} />}
    </Helmet>
  );
}
