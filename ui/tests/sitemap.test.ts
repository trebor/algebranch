// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The crawl surface's index (#501). The sitemap must list the human-crawlable
// routes on the canonical origin — the app shell, the privacy page, and the new
// link-format spec — and must NOT advertise the API or the share-redirect route,
// which carry no indexable content. #499's worked-example pages will extend this
// list as they land.
import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/constants/site';

describe('sitemap.ts (#501)', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it('lists the crawlable routes on the canonical origin', () => {
    expect(urls).toContain(`${SITE_URL}`);
    expect(urls).toContain(`${SITE_URL}/privacy`);
    expect(urls).toContain(`${SITE_URL}/link-format`);
  });

  it('excludes non-content routes (api, share redirect)', () => {
    expect(urls.some((u) => u.includes('/api'))).toBe(false);
    expect(urls.some((u) => u.endsWith('/s'))).toBe(false);
  });

  it('gives every entry an absolute https URL and a lastModified date', () => {
    for (const e of entries) {
      expect(e.url.startsWith('https://')).toBe(true);
      expect(e.lastModified).toBeTruthy();
    }
  });
});
