// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// @vitest-environment node

// The in-app documentation modal (#514) reuses the same `docs/*.md` source the
// crawlable /<slug> routes render. These tests pin the shared body loader: it
// yields real, chrome-stripped markdown for every help doc, so the modal and the
// route can never show different text.
import { describe, it, expect } from 'vitest';
import { getDocBody } from '@/utils/renderDocPage';
import { HELP_DOC_SLUGS } from '@/constants/docsPages';

describe('help doc bodies (#514)', () => {
  it('exposes exactly the content docs, excluding the index hub', () => {
    expect(HELP_DOC_SLUGS).toEqual(['user-guide', 'scope', 'features', 'faq']);
    expect(HELP_DOC_SLUGS).not.toContain('docs');
  });

  it('loads non-empty, chrome-stripped markdown for every help doc', () => {
    for (const slug of HELP_DOC_SLUGS) {
      const body = getDocBody(slug);
      expect(body.length, slug).toBeGreaterThan(0);
      // The leading H1 and the GitHub nav row (`[User Guide](user-guide.md) • …`)
      // are stripped chrome — the domain page and the modal supply their own
      // header. In-body sibling links survive; DocMarkdown rewrites them.
      expect(body.startsWith('# '), slug).toBe(false);
      expect(body, slug).not.toMatch(/\]\([a-z-]+\.md[^)]*\)\s+•/);
    }
  });
});
