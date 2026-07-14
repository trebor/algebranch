// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { NAV_SECTIONS, NAV_ENTRIES, HELP_DOC_SLUGS } from '@/constants/docsPages';
import { DocsCrossNav, DocsIndex } from '@/components/DocsNav';

// #520: one navigational registry (NAV_SECTIONS) feeds the Help launcher, the
// /docs hub, and the cross-nav footer on every doc and privacy page. These tests
// pin the registry shape and the two shared listings so the surfaces cannot drift
// apart — and, in particular, so the two privacy documents always travel together.

describe('NAV_SECTIONS registry', () => {
  const byLabel = (label: string) => NAV_SECTIONS.find((s) => s.label === label)!;

  it('groups into Guides and Privacy & Trust, in that order', () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual(['Guides', 'Privacy & Trust']);
  });

  it('lists the four usage guides as in-app modal entries, matching HELP_DOC_SLUGS', () => {
    const guides = byLabel('Guides').entries;
    expect(guides.map((e) => e.href)).toEqual([
      '/user-guide',
      '/scope',
      '/features',
      '/faq',
    ]);
    expect(guides.every((e) => e.open === 'modal')).toBe(true);
    // Modal entries carry the slug the DocModal opens; it matches the modal set.
    expect(guides.map((e) => e.slug)).toEqual(HELP_DOC_SLUGS);
  });

  it('pairs the Privacy Policy with Privacy for Schools, both opening as routes', () => {
    const privacy = byLabel('Privacy & Trust').entries;
    expect(privacy.map((e) => e.href)).toEqual(['/privacy', '/school-privacy']);
    expect(privacy.every((e) => e.open === 'route')).toBe(true);
    // Route entries navigate to a full page, so they carry no doc-modal slug.
    expect(privacy.every((e) => e.slug === undefined)).toBe(true);
  });

  it('flattens every entry into NAV_ENTRIES with unique hrefs', () => {
    const hrefs = NAV_ENTRIES.map((e) => e.href);
    expect(hrefs).toEqual(['/user-guide', '/scope', '/features', '/faq', '/privacy', '/school-privacy']);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('DocsCrossNav footer', () => {
  afterEach(cleanup);

  it('links every other page, grouped, and omits the page you are on', () => {
    render(<DocsCrossNav currentPath="/privacy" />);
    // The current page is not linked to itself...
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
    // ...but its sibling privacy doc and the guides are all reachable.
    for (const name of ['Privacy for Schools', 'User Guide', 'Frequently Asked Questions']) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
    // Grouped: both section labels are present.
    expect(screen.getByText('Guides')).toBeTruthy();
    expect(screen.getByText('Privacy & Trust')).toBeTruthy();
  });

  it('reaches both privacy documents from a usage-guide page', () => {
    render(<DocsCrossNav currentPath="/user-guide" />);
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Privacy for Schools' })).toHaveAttribute(
      'href',
      '/school-privacy',
    );
  });
});

describe('DocsIndex hub body', () => {
  afterEach(cleanup);

  it('lists every documented page grouped, plus the shortcuts reference', () => {
    render(<DocsIndex />);
    const guides = screen.getByRole('heading', { name: 'Guides' }).parentElement!;
    expect(within(guides).getByRole('link', { name: 'User Guide' })).toHaveAttribute(
      'href',
      '/user-guide',
    );
    const privacy = screen.getByRole('heading', { name: 'Privacy & Trust' }).parentElement!;
    expect(within(privacy).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(privacy).getByRole('link', { name: 'Privacy for Schools' })).toHaveAttribute(
      'href',
      '/school-privacy',
    );
    expect(screen.getByRole('link', { name: 'Keyboard Shortcuts' })).toHaveAttribute(
      'href',
      '/shortcuts',
    );
  });
});
