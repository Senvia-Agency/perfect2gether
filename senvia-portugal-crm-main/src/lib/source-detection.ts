/**
 * Intelligent lead source detection with multiple fallback strategies
 * Priority: UTM > Click IDs > Referrer > Direct
 */

// Map common UTM source values to friendly labels
const sourceMapping: Record<string, string> = {
  'facebook': 'Facebook',
  'fb': 'Facebook',
  'instagram': 'Instagram',
  'ig': 'Instagram',
  'google': 'Google',
  'youtube': 'Youtube',
  'linkedin': 'LinkedIn',
  'tiktok': 'TikTok',
  'twitter': 'Twitter',
  'x': 'Twitter',
  'email': 'Email Marketing',
  'newsletter': 'Newsletter',
  'whatsapp': 'WhatsApp',
  'sms': 'SMS',
};

export const mapSourceToLabel = (source: string | null): string => {
  if (!source) return 'Direto';
  return sourceMapping[source.toLowerCase()] || source;
};

/**
 * Detect referrer-based source from document.referrer
 */
const detectReferrerSource = (referrer: string): string | null => {
  if (!referrer) return null;
  
  const lowerReferrer = referrer.toLowerCase();
  
  // Facebook domains (including redirect links)
  if (lowerReferrer.includes('facebook.com') || 
      lowerReferrer.includes('fb.com') || 
      lowerReferrer.includes('l.facebook.com') ||
      lowerReferrer.includes('m.facebook.com') ||
      lowerReferrer.includes('lm.facebook.com')) {
    return 'Facebook';
  }
  
  // Instagram domains
  if (lowerReferrer.includes('instagram.com') || 
      lowerReferrer.includes('l.instagram.com')) {
    return 'Instagram';
  }
  
  // Google domains
  if (lowerReferrer.includes('google.com') || 
      lowerReferrer.includes('google.pt') ||
      lowerReferrer.includes('google.co.') ||
      lowerReferrer.includes('googleapis.com')) {
    return 'Google';
  }
  
  // YouTube
  if (lowerReferrer.includes('youtube.com') || lowerReferrer.includes('youtu.be')) {
    return 'YouTube';
  }
  
  // LinkedIn
  if (lowerReferrer.includes('linkedin.com') || lowerReferrer.includes('lnkd.in')) {
    return 'LinkedIn';
  }
  
  // TikTok
  if (lowerReferrer.includes('tiktok.com')) {
    return 'TikTok';
  }
  
  // Twitter/X
  if (lowerReferrer.includes('twitter.com') || 
      lowerReferrer.includes('x.com') || 
      lowerReferrer.includes('t.co')) {
    return 'Twitter/X';
  }
  
  // WhatsApp Web
  if (lowerReferrer.includes('web.whatsapp.com') || lowerReferrer.includes('whatsapp.com')) {
    return 'WhatsApp';
  }
  
  // Has referrer but not recognized - it's from a landing page or other site
  return 'Landing Page';
};

export interface SourceDetectionResult {
  source: string;
  tracking: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    fbclid?: string;
    gclid?: string;
    ttclid?: string;
    referrer?: string;
  };
}

/**
 * Comprehensive source detection with fallback chain:
 * 1. UTM source (most reliable when set)
 * 2. Click IDs (fbclid, gclid, ttclid)
 * 3. Document referrer analysis
 * 4. Direct (no source detected)
 */
export const detectLeadSource = (): SourceDetectionResult => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Collect all tracking parameters
  const tracking: SourceDetectionResult['tracking'] = {};
  
  // UTM parameters
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmContent = urlParams.get('utm_content');
  const utmTerm = urlParams.get('utm_term');
  
  if (utmSource) tracking.utm_source = utmSource;
  if (utmMedium) tracking.utm_medium = utmMedium;
  if (utmCampaign) tracking.utm_campaign = utmCampaign;
  if (utmContent) tracking.utm_content = utmContent;
  if (utmTerm) tracking.utm_term = utmTerm;
  
  // Click IDs
  const fbclid = urlParams.get('fbclid');
  const gclid = urlParams.get('gclid');
  const ttclid = urlParams.get('ttclid');
  
  if (fbclid) tracking.fbclid = fbclid;
  if (gclid) tracking.gclid = gclid;
  if (ttclid) tracking.ttclid = ttclid;
  
  // Referrer
  const referrer = document.referrer;
  if (referrer) tracking.referrer = referrer;
  
  // --- Detection Priority Chain ---
  
  // 1. UTM source (highest priority - explicitly set)
  if (utmSource) {
    return {
      source: mapSourceToLabel(utmSource),
      tracking,
    };
  }
  
  // 2. Click IDs (indicate paid traffic even without UTMs)
  if (fbclid) {
    return {
      source: 'Facebook Ads',
      tracking,
    };
  }
  
  if (gclid) {
    return {
      source: 'Google Ads',
      tracking,
    };
  }
  
  if (ttclid) {
    return {
      source: 'TikTok Ads',
      tracking,
    };
  }
  
  // 3. Referrer analysis
  const referrerSource = detectReferrerSource(referrer);
  if (referrerSource) {
    return {
      source: referrerSource,
      tracking,
    };
  }
  
  // 4. No source detected - direct access
  return {
    source: 'Direto',
    tracking,
  };
};
