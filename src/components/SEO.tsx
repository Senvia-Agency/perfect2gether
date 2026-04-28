import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: string;
}

const DEFAULT_TITLE = "Perfect2Gether - CRM Inteligente";
const DEFAULT_DESCRIPTION = "Perfect2Gether - CRM com automação WhatsApp e IA.";
const SITE_URL = "https://app.perfect2gether.pt";

export function SEO({ 
  title, 
  description, 
  canonical, 
  noindex = false,
  ogImage = "/og-image.png",
  ogType = "website"
}: SEOProps) {
  const fullTitle = title ? `${title} | Perfect2Gether` : DEFAULT_TITLE;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${SITE_URL}${ogImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={fullOgImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:locale" content="pt_PT" />
      <meta property="og:site_name" content="Perfect2Gether" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={fullOgImage} />
    </Helmet>
  );
}
