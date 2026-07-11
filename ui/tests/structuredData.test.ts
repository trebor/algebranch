// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// schema.org JSON-LD for the app shell (#501): the machine-readable "what is this"
// that AI answer engines and search read to describe and cite Algebranch. Pin the
// fields they key on — type, name, canonical url, free price, education category —
// and confirm it serializes to valid JSON so a malformed graph can never ship.
import { describe, it, expect } from 'vitest';
import { softwareApplicationJsonLd } from '@/constants/structuredData';
import { SITE_URL } from '@/constants/site';

describe('softwareApplicationJsonLd (#501)', () => {
  it('is a valid schema.org SoftwareApplication graph', () => {
    expect(softwareApplicationJsonLd['@context']).toBe('https://schema.org');
    const types = ([] as string[]).concat(softwareApplicationJsonLd['@type']);
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('WebApplication');
  });

  it('names the product and its canonical url', () => {
    expect(softwareApplicationJsonLd.name).toBe('Algebranch');
    expect(softwareApplicationJsonLd.url).toBe(SITE_URL);
  });

  it('advertises a free, education-category web app', () => {
    expect(softwareApplicationJsonLd.applicationCategory).toBe('EducationalApplication');
    expect(softwareApplicationJsonLd.offers).toMatchObject({
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    });
  });

  it('serializes to JSON without throwing', () => {
    expect(() => JSON.stringify(softwareApplicationJsonLd)).not.toThrow();
  });
});
