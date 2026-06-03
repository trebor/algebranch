'use client';

/**
 * Log a pageview to Google Analytics
 */
export const pageview = (url: string) => {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return;

  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', gaId, {
      page_path: url,
    });
  }
};

interface EventProps {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

/**
 * Log a custom event to Google Analytics
 */
export const trackEvent = ({ action, category, label, value }: EventProps) => {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return;

  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};
