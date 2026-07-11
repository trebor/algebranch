// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * schema.org JSON-LD describing the app (#501). This is the structured,
 * machine-readable "what is this" that search engines and AI answer engines read
 * to describe and cite Algebranch — a free, browser-based educational algebra
 * tool. Injected once on the shell in `app/layout.tsx`. Per-page markup (e.g.
 * #499's worked-example pages) layers on top of this base.
 */
import { SITE_URL } from './site';
import { APP_NAME, APP_TAGLINE } from './brand';

export const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['SoftwareApplication', 'WebApplication'],
  name: APP_NAME,
  alternateName: `${APP_NAME} - ${APP_TAGLINE}`,
  url: SITE_URL,
  description:
    'A free tool for solving algebra equations by hand: you make every move and the engine only permits valid steps, so the math stays correct. A practice environment, not an answer engine.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a modern web browser with JavaScript.',
  isAccessibleForFree: true,
  inLanguage: 'en',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
} as const;
