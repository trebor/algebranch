// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Shared, markup-only navigation for the documentation surface (#520). Both the
// markdown-rendered doc routes and the bespoke interactive /privacy page render
// these, so they cannot import the fs-backed renderDocPage module — this one is
// pure and derives entirely from NAV_SECTIONS, the single navigational registry.
// DocsCrossNav is the grouped footer every page carries; DocsIndex is the body of
// the /docs hub. Both group by Guides / Privacy & Trust so the two privacy
// documents always travel together and a future doc appears in one edit.
import Link from 'next/link';
import { THEME_GLASS } from '../constants/theme';
import { NAV_SECTIONS } from '../constants/docsPages';

const SECTION_LABEL = `text-xs font-semibold uppercase tracking-wider ${THEME_GLASS.TEXT_MUTED}`;

// The sibling-page footer: every section's entries as links, minus the page you
// are on. Grouped, so a doc footer reaches both privacy documents and the guides.
export function DocsCrossNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="Documentation"
      className={`flex flex-col gap-3 border-t ${THEME_GLASS.PANEL_BORDER} pt-4 text-sm`}
    >
      {NAV_SECTIONS.map((section) => {
        const entries = section.entries.filter((entry) => entry.href !== currentPath);
        if (entries.length === 0) return null;
        return (
          <div key={section.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className={SECTION_LABEL}>{section.label}</span>
            {entries.map((entry) => (
              <Link key={entry.href} href={entry.href} className={THEME_GLASS.LINK}>
                {entry.title}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

// The /docs hub body: every documented page, grouped, with its answer-shaped
// description. Generated from NAV_SECTIONS so it can never drift from the routes,
// the footer, or the Help launcher. The keyboard-shortcuts reference is a route
// of its own (not a doc), appended here so the hub still points to it.
export function DocsIndex() {
  return (
    <div className="flex flex-col gap-6">
      {NAV_SECTIONS.map((section) => (
        <section key={section.label} className="flex flex-col gap-2">
          <h2 className={`text-lg font-bold ${THEME_GLASS.TEXT_HEADING} tracking-tight`}>
            {section.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {section.entries.map((entry) => (
              <li key={entry.href}>
                <Link href={entry.href} className={`font-semibold ${THEME_GLASS.LINK}`}>
                  {entry.title}
                </Link>
                <span className={THEME_GLASS.TEXT_MUTED}> — {entry.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h2 className={`text-lg font-bold ${THEME_GLASS.TEXT_HEADING} tracking-tight`}>Reference</h2>
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/shortcuts" className={`font-semibold ${THEME_GLASS.LINK}`}>
              Keyboard Shortcuts
            </Link>
            <span className={THEME_GLASS.TEXT_MUTED}>
              {' '}
              — every key, chord, and modifier, rendered from the same catalog the in-app
              cheat-sheet uses.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
