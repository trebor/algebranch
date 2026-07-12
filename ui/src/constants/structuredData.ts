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
import type { FaqEntry } from '../utils/docsMarkdown';

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

// Per-page markup for the on-domain docs (#509). These layer on top of the base
// SoftwareApplication node above: the FAQ ships FAQPage (answer-shaped, ideal AEO
// material) and each prose guide ships TechArticle, so answer engines can cite the
// specific page rather than only the app shell.

export function faqPageJsonLd(entries: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

export function docArticleJsonLd({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: APP_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: APP_NAME, url: SITE_URL },
  };
}
