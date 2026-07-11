// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Canonical origin + crawl-surface constants (#501). The single source of truth
 * for the production origin used by the metadata routes (`app/robots.ts`,
 * `app/sitemap.ts`), the JSON-LD structured data, and the `?eq=` link builder.
 * Mirrors the `metadataBase` in `app/layout.tsx`; keep them in lockstep.
 */
export const SITE_URL = 'https://algebranch.org';

/**
 * The AI crawlers we explicitly welcome in robots.txt (#501). Naming them by
 * name — rather than relying on the `*` wildcard alone — is the unambiguous
 * "yes, index us" signal these fetchers look for. They feed the retrieval-time
 * citation pathway (ChatGPT search, Perplexity, Copilot, Google AI Overviews).
 */
export const AI_CRAWLER_USER_AGENTS = [
  'GPTBot', // OpenAI / ChatGPT
  'OAI-SearchBot', // ChatGPT search citations
  'ChatGPT-User', // ChatGPT on-demand browsing
  'ClaudeBot', // Anthropic / Claude
  'Claude-Web', // Claude on-demand browsing
  'PerplexityBot', // Perplexity
  'Google-Extended', // Google Gemini / AI Overviews grounding
] as const;
