// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// sitemap.xml — the crawl surface's index (#501). Lists the human-crawlable
// routes on the canonical origin so search + AI crawlers discover them without
// guessing. The `/api/*` endpoints and the `/s` share redirect are deliberately
// absent (no indexable content). #499's worked-example pages will extend this
// list as they land.
import type { MetadataRoute } from 'next';
import { SITE_URL } from '../constants/site';
import { DOCS_PAGES } from '../constants/docsPages';
import { PRESET_LIST } from '../constants/presets';


export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/input-format`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/link-format`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // The keyboard-shortcuts reference (#514), rendered from the shared catalog.
    // `/help` is intentionally absent — it is a redirect to `/docs`, not indexable
    // content of its own.
    {
      url: `${SITE_URL}/shortcuts`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // The on-domain documentation mirror (#509), rendered from docs/*.md.
    ...DOCS_PAGES.map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // Solve landing pages for solvable library equations.
    ...PRESET_LIST.filter((preset) => preset.type === 'solvable').map((preset) => ({
      url: `${SITE_URL}/solve/${preset.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}

