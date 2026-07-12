// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * The on-domain documentation surface (#509). The explanatory "what is this /
 * what can it do" prose lives in `docs/*.md` as the single source of truth; these
 * pages render from that markdown at build time so search + AI answer engines can
 * cite it on the live domain instead of only inside the GitHub repo. Each entry
 * maps a route slug to its source markdown file and the metadata/structured-data
 * shape the page ships. Adding a page here wires it into the routes, the sitemap,
 * and the cross-link nav in one place.
 */

// `article` → TechArticle JSON-LD; `faq` → FAQPage JSON-LD; `index` → the hub.
export type DocKind = 'article' | 'faq' | 'index';

export interface DocPageMeta {
  /** Route path segment and sitemap key, e.g. `faq` → `/faq`. */
  slug: string;
  /** Source markdown file within `docs/`. */
  file: string;
  /** Rendered page <h1> and the base of its <title>. */
  title: string;
  /** Meta description — written answer-shaped for retrieval. */
  description: string;
  kind: DocKind;
}

export const DOCS_PAGES: DocPageMeta[] = [
  {
    slug: 'docs',
    file: 'index.md',
    title: 'Documentation',
    description:
      'Algebranch documentation: the user guide, scope and capabilities, features reference, and FAQ for the by-hand algebra practice tool.',
    kind: 'index',
  },
  {
    slug: 'user-guide',
    file: 'user-guide.md',
    title: 'User Guide',
    description:
      'How to use Algebranch: the two-click selection model, transposing terms, simplify and rewrite handles, the branching history tree, and deep-link sharing.',
    kind: 'article',
  },
  {
    slug: 'scope',
    file: 'scope.md',
    title: 'Scope & Capabilities',
    description:
      'What math Algebranch supports — linear and quadratic equations, factoring, radicals, complex numbers, inequalities — what is out of scope, and how the numeric equivalence engine works.',
    kind: 'article',
  },
  {
    slug: 'features',
    file: 'features.md',
    title: 'Features Reference',
    description:
      'Every transposition, transform, identity, global operation, preset, and setting in Algebranch, plus the full keyboard-shortcut reference.',
    kind: 'article',
  },
  {
    slug: 'faq',
    file: 'faq.md',
    title: 'Frequently Asked Questions',
    description:
      'Answers to common Algebranch questions: is my work uploaded, will it solve equations for me, what math it can and cannot do, mobile support, and why a move may be blocked.',
    kind: 'faq',
  },
];

export const DOC_BY_SLUG: Record<string, DocPageMeta> = Object.fromEntries(
  DOCS_PAGES.map((page) => [page.slug, page]),
);
