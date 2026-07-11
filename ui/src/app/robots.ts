// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// robots.txt for the retrieval-time citation pathway (#501). We explicitly
// welcome the AI crawlers that ground ChatGPT/Perplexity/Copilot/Google AI
// Overviews — naming each one is the unambiguous "index us" signal — alongside
// the standard `*` rule. Every rule keeps the API endpoints and the `/s` share
// redirect (no indexable content) out of the crawl and points at the sitemap.
import type { MetadataRoute } from 'next';
import { SITE_URL, AI_CRAWLER_USER_AGENTS } from '../constants/site';

// Non-content routes: `/api/*` are JSON endpoints and `/s` is a client-side
// redirect that resolves an opaque share fragment — nothing to index.
const DISALLOW = ['/api/', '/s'];

export default function robots(): MetadataRoute.Robots {
  const userAgents = ['*', ...AI_CRAWLER_USER_AGENTS];
  return {
    rules: userAgents.map((userAgent) => ({
      userAgent,
      allow: '/',
      disallow: DISALLOW,
    })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
