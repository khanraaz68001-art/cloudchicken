// SEO configuration and utilities
export const seoConfig = {
  siteName: "Cloud Chicken",
  siteUrl: "https://cloudchicken.in",
  defaultTitle: "Cloud Chicken - Fresh Chicken Delivery in Dibrugarh",
  defaultDescription: "Premium quality fresh chicken delivered to your doorstep in Dibrugarh in under 2 hours. Browse our wide selection of chicken cuts, order online, and enjoy fast delivery in Dibrugarh, Assam.",
  defaultKeywords: "chicken delivery dibrugarh, fresh chicken dibrugarh, chicken home delivery assam, online chicken order, dibrugarh chicken delivery, fresh chicken near me, chicken delivery service, cloud chicken dibrugarh",
  location: {
    city: "Dibrugarh",
    state: "Assam",
    country: "India",
    coordinates: {
      lat: 27.4728,
      lng: 94.9110
    }
  },
  business: {
    name: "Cloud Chicken",
    phone: "+91 8099747830",
    address: "Amolapatty, Rosegali, Dibrugarh, Assam 786001",
    email: "info@cloudchicken.in"
  }
};

// Generate structured data for different page types
export const generateStructuredData = (pageType: string, pageData?: any) => {
  const baseData = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "FoodEstablishment", "DeliveryService"],
    "name": seoConfig.siteName,
    "url": seoConfig.siteUrl,
    "telephone": seoConfig.business.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Amolapatty, Rosegali",
      "addressLocality": seoConfig.location.city,
      "addressRegion": seoConfig.location.state,
      "postalCode": "786001",
      "addressCountry": "IN"
    }
  };

  switch (pageType) {
    case 'homepage':
      return {
        ...baseData,
        "description": seoConfig.defaultDescription,
        "priceRange": "₹₹",
        "servesCuisine": "Indian",
        "serviceType": "Delivery"
      };
    case 'menu':
      return {
        ...baseData,
        "@type": "Restaurant",
        "hasMenu": `${seoConfig.siteUrl}/menu`,
        "description": "Fresh chicken menu with various cuts and sizes available for delivery in Dibrugarh"
      };
    default:
      return baseData;
  }
};

// SEO-friendly page titles
export const generatePageTitle = (pageTitle?: string) => {
  if (!pageTitle) return seoConfig.defaultTitle;
  return `${pageTitle} - ${seoConfig.siteName}`;
};

// Local SEO keywords for different pages
export const localKeywords = {
  homepage: "chicken delivery dibrugarh, fresh chicken dibrugarh, chicken home delivery assam, online chicken order dibrugarh",
  menu: "chicken menu dibrugarh, fresh chicken cuts, chicken varieties dibrugarh, order chicken online",
  cart: "chicken order dibrugarh, checkout chicken delivery, buy chicken online dibrugarh",
  login: "cloud chicken login, chicken delivery account, dibrugarh chicken order login"
};