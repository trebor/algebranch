// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { faqPageJsonLd, docArticleJsonLd } from '../src/constants/structuredData';

// Per-page schema.org markup (#509): FAQPage for the FAQ, TechArticle for the
// prose guides. Crawlers and AI answer engines read these to cite the pages.
describe('faqPageJsonLd', () => {
  it('wraps entries as a FAQPage with Question/acceptedAnswer nodes', () => {
    const jsonLd = faqPageJsonLd([
      { question: 'Is my work uploaded?', answer: 'No. It stays on your device.' },
      { question: 'Will it solve for me?', answer: 'No. You make every move.' },
    ]);
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity).toHaveLength(2);
    expect(jsonLd.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Is my work uploaded?',
      acceptedAnswer: { '@type': 'Answer', text: 'No. It stays on your device.' },
    });
  });

  it('serializes to valid JSON', () => {
    const jsonLd = faqPageJsonLd([{ question: 'Q?', answer: 'A.' }]);
    expect(() => JSON.stringify(jsonLd)).not.toThrow();
  });
});

describe('docArticleJsonLd', () => {
  it('builds a TechArticle carrying the page headline, description, and URL', () => {
    const jsonLd = docArticleJsonLd({
      title: 'Scope & Capabilities',
      description: 'What Algebranch can and cannot do.',
      url: 'https://algebranch.org/scope',
    });
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('TechArticle');
    expect(jsonLd.headline).toBe('Scope & Capabilities');
    expect(jsonLd.description).toBe('What Algebranch can and cannot do.');
    expect(jsonLd.url).toBe('https://algebranch.org/scope');
    expect(jsonLd.inLanguage).toBe('en');
  });
});
