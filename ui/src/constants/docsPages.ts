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

/**
 * The navigational family a doc belongs to. `guide` docs are usage documentation
 * that open in the in-app doc modal; `policy` docs are trust/privacy statements
 * that open as full routes alongside the (non-markdown) Privacy Policy page. The
 * `docs` hub itself belongs to no group. This is the axis every launcher, footer,
 * and hub listing groups by, so the two privacy documents always travel together.
 */
export type DocGroup = 'guide' | 'policy';

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
  /** Navigational family; omitted for the `docs` hub, which lists the rest. */
  group?: DocGroup;
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
    group: 'guide',
  },
  {
    slug: 'scope',
    file: 'scope.md',
    title: 'Scope & Capabilities',
    description:
      'What math Algebranch supports — linear and quadratic equations, factoring, radicals, complex numbers, inequalities — what is out of scope, and how the numeric equivalence engine works.',
    kind: 'article',
    group: 'guide',
  },
  {
    slug: 'features',
    file: 'features.md',
    title: 'Features Reference',
    description:
      'Every transposition, transform, identity, global operation, preset, and setting in Algebranch, and a pointer to the full keyboard-shortcut reference.',
    kind: 'article',
    group: 'guide',
  },
  {
    slug: 'school-privacy',
    file: 'school-privacy.md',
    title: 'Privacy for Schools',
    description:
      'Algebranch student-data privacy posture for teachers and districts: no accounts, no sign-in, no PII collected, no education records held, and zero-knowledge share links — with COPPA and FERPA stances stated plainly.',
    kind: 'article',
    group: 'policy',
  },
  {
    slug: 'faq',
    file: 'faq.md',
    title: 'Frequently Asked Questions',
    description:
      'Answers to common Algebranch questions: is my work uploaded, will it solve equations for me, what math it can and cannot do, mobile support, and why a move may be blocked.',
    kind: 'faq',
    group: 'guide',
  },
];

export const DOC_BY_SLUG: Record<string, DocPageMeta> = Object.fromEntries(
  DOCS_PAGES.map((page) => [page.slug, page]),
);

/**
 * The Privacy Policy page (#520). Unlike the other trust doc, it is not rendered
 * from markdown — it is a bespoke interactive route (`/privacy`) with a live
 * consent control — so it lives outside DOCS_PAGES. It still belongs in every
 * navigational listing next to Privacy for Schools, so it is registered here and
 * folded into `NAV_SECTIONS` below. Keep the description consistent with the page.
 */
export const PRIVACY_POLICY_PAGE = {
  slug: 'privacy',
  title: 'Privacy Policy',
  description:
    'How Algebranch handles your data: cookieless aggregate analytics by default, opt-in usage events, and zero-knowledge share links the server can never read.',
} as const;

/**
 * The docs opened as in-app modals from the Help launcher (#514): the usage
 * `guide` docs only. Policy docs (Privacy for Schools) open as full routes next
 * to the Privacy Policy page, not in the read-only modal, so they are excluded
 * here. Each guide still has its own crawlable `/<slug>` route — the modal is an
 * in-app convenience, the route is the canonical deep-link target.
 */
export const HELP_DOC_SLUGS: string[] = DOCS_PAGES.filter(
  (page) => page.group === 'guide',
).map((page) => page.slug);

/**
 * How a navigational entry opens from a launcher: `modal` opens the in-app doc
 * modal in place (guides); `route` navigates to the full page (the privacy docs,
 * one of which is interactive and cannot render in the read-only modal).
 */
export type NavOpenMode = 'modal' | 'route';

export interface NavEntry {
  title: string;
  description: string;
  /** Canonical route path, e.g. `/user-guide`, `/privacy`. */
  href: string;
  open: NavOpenMode;
  /** The doc-modal slug; present only when `open === 'modal'`. */
  slug?: string;
}

export interface NavSection {
  label: string;
  entries: NavEntry[];
}

const guideEntries = (): NavEntry[] =>
  DOCS_PAGES.filter((page) => page.group === 'guide').map((page) => ({
    title: page.title,
    description: page.description,
    href: `/${page.slug}`,
    open: 'modal',
    slug: page.slug,
  }));

const privacyEntries = (): NavEntry[] => [
  {
    title: PRIVACY_POLICY_PAGE.title,
    description: PRIVACY_POLICY_PAGE.description,
    href: `/${PRIVACY_POLICY_PAGE.slug}`,
    open: 'route',
  },
  ...DOCS_PAGES.filter((page) => page.group === 'policy').map((page) => ({
    title: page.title,
    description: page.description,
    href: `/${page.slug}`,
    open: 'route' as const,
  })),
];

/**
 * The single navigational registry every listing renders from — the Help
 * launcher, the on-domain docs hub (`/docs`), and the cross-nav footer on every
 * doc and privacy page. Grouped so the two privacy documents always appear
 * together and adding a future doc to DOCS_PAGES surfaces it everywhere at once,
 * with no hand-maintained list to drift.
 */
export const NAV_SECTIONS: NavSection[] = [
  { label: 'Guides', entries: guideEntries() },
  { label: 'Privacy & Trust', entries: privacyEntries() },
];

/** Every navigational entry, flattened — convenient for lookups by href. */
export const NAV_ENTRIES: NavEntry[] = NAV_SECTIONS.flatMap((section) => section.entries);
