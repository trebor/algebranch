// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

/**
 * Analytics event action names and taxonomy.
 */
export const ANALYTICS_EVENTS = {
  STALL_DETECTED: 'stall_detected',
  // Reserved for #497 (hint ladder): fires when a user requests a hint.
  // Value should be the rung level (1: Strategy, 2: Orientation, 3: Specific move).
  HINT_REQUESTED: 'hint_requested',
} as const;


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
