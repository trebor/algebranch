// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Log a pageview to Google Analytics
 */
export const pageview = (url: string) => {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return;

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', gaId, {
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

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};
