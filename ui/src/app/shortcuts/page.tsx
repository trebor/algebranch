// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The keyboard-shortcuts reference (#514). The same catalog the in-app `K`
// cheat-sheet renders — SHORTCUT_CATALOG (constants/shortcutCatalog.ts) — served
// here as an on-domain, crawlable, zero-hydration page, mirroring the
// /input-format precedent (#507). Because the live key handler and this page both
// read that one catalog, the page can never document a binding the app lacks; the
// hand-typed shortcut table that used to live in docs/features.md is gone,
// replaced by a pointer here. Keycaps render platform-neutral (`Ctrl/Cmd`) since a
// static page has no navigator to detect the platform.
import type { Metadata } from 'next';
import Link from 'next/link';
import { THEME_GLASS } from '../../constants/theme';
import { BackToWorkspaceLink } from '../../components/BackToWorkspaceLink';
import { SITE_URL } from '../../constants/site';
import { docArticleJsonLd } from '../../constants/structuredData';
import {
  SHORTCUT_CATALOG,
  groupShortcutsByCategory,
  type ShortcutCatalogEntry,
} from '../../constants/shortcutCatalog';
import { formatShortcutStatic } from '../../utils/keyboardShortcuts';

export const dynamic = 'force-static';

const TITLE = 'Keyboard shortcuts';
const DESCRIPTION =
  'Every keyboard shortcut in Algebranch: history, panels, workspaces, both-sides operations, copy and share chords, and accessibility keys. The same list the in-app cheat-sheet shows, rendered from one source so it never drifts.';

export const metadata: Metadata = {
  title: 'Keyboard shortcuts — Algebranch',
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/shortcuts` },
  openGraph: {
    title: 'Algebranch keyboard shortcuts',
    description: DESCRIPTION,
    url: `${SITE_URL}/shortcuts`,
    type: 'article',
  },
};

const groups = groupShortcutsByCategory(SHORTCUT_CATALOG);

/** The keycap text for a binding: the explicit keyLabel override, else the
 *  platform-neutral rendering shared with the app's cheat-sheet. */
function keycap(entry: ShortcutCatalogEntry): string {
  return entry.keyLabel ?? formatShortcutStatic(entry);
}

function Keycap({ children }: { children: React.ReactNode }) {
  return <kbd className={THEME_GLASS.SHORTCUT_KEYCAP}>{children}</kbd>;
}

export default function ShortcutsPage() {
  const jsonLd = docArticleJsonLd({
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/shortcuts`,
  });

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
          <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
            <h1
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING}`}
            >
              Keyboard shortcuts
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
              Single-key shortcuts work whenever you are <em>not</em> typing in a text field. Press{' '}
              <code className={THEME_GLASS.CODE_CHIP}>?</code> in the app for the Help menu, or{' '}
              <code className={THEME_GLASS.CODE_CHIP}>K</code> for this list as an overlay. Where a
              shortcut uses a modifier, <code className={THEME_GLASS.CODE_CHIP}>Ctrl/Cmd</code> means
              Ctrl on Windows and Linux, ⌘ on a Mac.
            </p>
          </div>

          <div className={`flex flex-col gap-8 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            {groups.map((group) => (
              <section key={group.category} className="flex flex-col gap-3">
                <h2
                  className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}
                >
                  {group.category}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <tbody>
                      {group.items.map((entry) => (
                        <tr key={entry.id} className="border-b border-white/5 align-top">
                          <td className="py-2 pr-4">{entry.description}</td>
                          <td className="py-2 whitespace-nowrap text-right">
                            {entry.leader ? (
                              // Two-step sequence: "leader then key" as two keycaps.
                              <span className="inline-flex items-center gap-1.5 justify-end">
                                <Keycap>{formatShortcutStatic({ key: entry.leader })}</Keycap>
                                <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>then</span>
                                <Keycap>{formatShortcutStatic({ key: entry.key })}</Keycap>
                              </span>
                            ) : (
                              <Keycap>{keycap(entry)}</Keycap>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <section className="flex flex-col gap-3">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                Related
              </h2>
              <p>
                For what you can type into an equation, see the{' '}
                <Link href="/input-format" className={THEME_GLASS.LINK}>
                  equation input format
                </Link>
                . For the full catalog of transforms, identities, and settings — everything Algebranch
                can <em>do</em> — see the{' '}
                <Link href="/features" className={THEME_GLASS.LINK}>
                  features reference
                </Link>{' '}
                and the rest of the{' '}
                <Link href="/docs" className={THEME_GLASS.LINK}>
                  documentation
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
