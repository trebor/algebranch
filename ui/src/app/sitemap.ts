// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// sitemap.xml — the crawl surface's index (#501). Lists the human-crawlable
// routes on the canonical origin so search + AI crawlers discover them without
// guessing. The `/api/*` endpoints and the `/s` share redirect are deliberately
// absent (no indexable content). #499's worked-example pages will extend this
// list as they land.
import type { MetadataRoute } from 'next';
import { SITE_URL } from '../constants/site';

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
      url: `${SITE_URL}/link-format`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
