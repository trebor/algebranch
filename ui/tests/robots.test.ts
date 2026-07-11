// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The retrieval-pathway crawl surface (#501): robots.txt must explicitly welcome
// the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) that feed
// ChatGPT/Perplexity/Google AI Overviews, alongside the standard `*` rule, and
// point at the sitemap. These assertions pin that contract so a future edit that
// silently drops an AI bot or the sitemap link fails loudly.
import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';
import { SITE_URL, AI_CRAWLER_USER_AGENTS } from '@/constants/site';

describe('robots.ts (#501)', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const agents = rules.flatMap((r) =>
    Array.isArray(r.userAgent) ? r.userAgent : r.userAgent ? [r.userAgent] : [],
  );

  it('welcomes the wildcard crawler', () => {
    const wildcard = rules.find((r) =>
      Array.isArray(r.userAgent) ? r.userAgent.includes('*') : r.userAgent === '*',
    );
    expect(wildcard, 'a `*` rule must exist').toBeTruthy();
    expect(wildcard!.allow).toContain('/');
  });

  it('explicitly names every AI crawler and allows it', () => {
    for (const bot of AI_CRAWLER_USER_AGENTS) {
      expect(agents, `${bot} must be named`).toContain(bot);
      const rule = rules.find((r) =>
        Array.isArray(r.userAgent) ? r.userAgent.includes(bot) : r.userAgent === bot,
      )!;
      const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
      expect(allow, `${bot} must be allowed`).toContain('/');
    }
  });

  it('keeps non-content routes (api, share redirect) out of the crawl', () => {
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : rule.disallow
          ? [rule.disallow]
          : [];
      expect(disallow).toContain('/api/');
      expect(disallow).toContain('/s');
    }
  });

  it('points at the sitemap on the canonical origin', () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
