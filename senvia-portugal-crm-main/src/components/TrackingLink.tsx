import { ReactNode, useMemo } from 'react';

interface TrackingLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}

const PARAMS_TO_PRESERVE = [
  'utm_source',
  'utm_medium', 
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'ttclid'
];

export function buildUrlWithUtms(baseUrl: string): string {
  if (typeof window === 'undefined') return baseUrl;
  
  const currentParams = new URLSearchParams(window.location.search);
  
  try {
    const targetUrl = new URL(baseUrl, window.location.origin);
    
    PARAMS_TO_PRESERVE.forEach(param => {
      const value = currentParams.get(param);
      if (value) {
        targetUrl.searchParams.set(param, value);
      }
    });
    
    return targetUrl.toString();
  } catch {
    return baseUrl;
  }
}

export function TrackingLink({ href, children, ...props }: TrackingLinkProps) {
  const trackedHref = useMemo(() => buildUrlWithUtms(href), [href]);

  return (
    <a href={trackedHref} {...props}>
      {children}
    </a>
  );
}
