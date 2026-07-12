// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Shared builders for the on-domain documentation routes (#509). Every doc page
// is the same shape — back link, header, the markdown body, a cross-link nav, and
// per-page JSON-LD — differing only by slug, so the route files stay one-liners
// and this module owns the chrome. The source markdown is read from docs/*.md at
// build time (the pages are static), keeping docs/ the single source of truth.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { THEME_GLASS } from '../constants/theme';
import { BackToWorkspaceLink } from '../components/BackToWorkspaceLink';
import { SITE_URL } from '../constants/site';
import { DOC_BY_SLUG, DOCS_PAGES } from '../constants/docsPages';
import { faqPageJsonLd, docArticleJsonLd } from '../constants/structuredData';
import { stripDocChrome, extractFaqEntries } from './docsMarkdown';
import { DocMarkdown } from '../components/DocMarkdown';

function readDocMarkdown(file: string): string {
  return readFileSync(path.join(process.cwd(), '..', 'docs', file), 'utf8');
}

/**
 * The chrome-stripped body of a doc, keyed by route slug. Shared by the on-domain
 * route (below) and the in-app documentation modal (#514) so both render from the
 * one `docs/*.md` source and cannot drift. Server-only: reads the file at build.
 */
export function getDocBody(slug: string): string {
  return stripDocChrome(readDocMarkdown(DOC_BY_SLUG[slug].file));
}

export function buildDocMetadata(slug: string): Metadata {
  const meta = DOC_BY_SLUG[slug];
  const url = `${SITE_URL}/${slug}`;
  return {
    title: `${meta.title} — Algebranch`,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: {
      title: `Algebranch ${meta.title}`,
      description: meta.description,
      url,
      type: 'article',
    },
  };
}

// Sibling-page nav so each doc cross-links the rest of the set on-domain — the
// role the stripped GitHub nav row played in the source markdown.
function DocsCrossNav({ currentSlug }: { currentSlug: string }) {
  const others = DOCS_PAGES.filter((page) => page.slug !== currentSlug);
  return (
    <nav
      aria-label="Documentation"
      className={`flex flex-wrap gap-x-4 gap-y-2 border-t ${THEME_GLASS.PANEL_BORDER} pt-4 text-sm`}
    >
      {others.map((page) => (
        <Link key={page.slug} href={`/${page.slug}`} className={THEME_GLASS.LINK}>
          {page.title}
        </Link>
      ))}
    </nav>
  );
}

export function DocPageBody({ slug }: { slug: string }) {
  const meta = DOC_BY_SLUG[slug];
  const raw = readDocMarkdown(meta.file);
  const body = getDocBody(slug);
  const url = `${SITE_URL}/${slug}`;
  const jsonLd =
    meta.kind === 'faq'
      ? faqPageJsonLd(extractFaqEntries(raw))
      : docArticleJsonLd({ title: meta.title, description: meta.description, url });

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        {/* Per-page structured data, shipped in the initial HTML for crawlers. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <BackToWorkspaceLink />
        <div className={`${THEME_GLASS.PANEL} p-6 sm:p-10 flex flex-col gap-8`}>
          <header className={`flex flex-col gap-2 border-b ${THEME_GLASS.PANEL_BORDER} pb-4`}>
            <h1
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING}`}
            >
              {meta.title}
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>{meta.description}</p>
          </header>

          <div className={`flex flex-col gap-4 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            <DocMarkdown markdown={body} />
          </div>

          <DocsCrossNav currentSlug={slug} />
        </div>
      </div>
    </main>
  );
}
