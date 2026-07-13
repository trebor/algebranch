// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useSetAtom } from 'jotai';
import { THEME_GLASS } from '../../constants/theme';
import { consentAtom } from '../../store/consent';
import { BackToWorkspaceLink } from '../../components/BackToWorkspaceLink';

export default function PrivacyPage() {
  const setConsent = useSetAtom(consentAtom);

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        <BackToWorkspaceLink />
        <div className={`${THEME_GLASS.PANEL} p-6 sm:p-10 flex flex-col gap-8`}>
          <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING}`}>
              Privacy Policy
            </h1>
            <p className={`text-xs ${THEME_GLASS.TEXT_MUTED} font-mono`}>
              Last updated: July 12, 2026
            </p>
          </div>

          <div className={`flex flex-col gap-6 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                1. Overview
              </h2>
              <p>
                This policy describes how Algebranch handles your data. By default we see only cookieless, aggregate traffic counts that cannot identify you; anonymous usage analytics run only if you explicitly opt in.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                2. Analytics & Cookies
              </h2>
              <p>
                Our hosting platform, Vercel, records aggregate traffic statistics for all visits: page views, referrer, country, and device type. This measurement is cookieless — it sets no cookies, stores no personal identifiers, and cannot recognize you across sites or visits. Vercel discards its anonymous visitor hash within 24 hours, so not even Vercel can reconstruct a browsing history.
              </p>
              <p>
                Only when you opt in does Algebranch additionally enable Google Analytics 4 to collect aggregate, anonymous usage data about how visitors interact with the app. This helps us optimize performance and prioritize features. Google Analytics then sets a cookie named <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">_ga</code> to distinguish unique users, but it does not identify you personally. Until you opt in, Google Analytics does not run and no such cookie is set.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                3. What We Collect and What We Don&apos;t
              </h2>
              <p>
                <strong>We collect:</strong> Cookieless aggregate traffic statistics for all visits (page views, referrer, country, device type), plus — only if you opt in — anonymous interaction events such as starting a new workspace, importing preset equations, copying outputs, and undo/redo operations.
              </p>
              <p>
                <strong>We NEVER collect:</strong> The mathematical content of your equations, variable names, or intermediate derivation steps. All equation parsing and solving occurs entirely locally in your browser.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                4. Consent Control
              </h2>
              <p>
                Google Analytics tracking is disabled by default, backed by Google Consent Mode v2, until you opt in via the consent banner. You can change your choice at any time by clicking{' '}
                <button
                  onClick={() => setConsent('unset')}
                  className={`${THEME_GLASS.LINK} bg-transparent border-none cursor-pointer p-0 inline`}
                >
                  Cookie Settings
                </button>
                .
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                5. Shared Links
              </h2>
              <p>
                When you share your work, Algebranch defaults to a <strong>short link</strong> such as{' '}
                <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">algebranch.org/s#…</code>. This stores data on a server, but the server never receives the means to read it. Your browser encrypts the workspace with AES-128-GCM before uploading, and the server stores only the encrypted bytes. The decryption key is generated in your browser and travels in the link&apos;s <strong>fragment</strong> &mdash; the part after the{' '}
                <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">#</code>{' '}
                &mdash; which browsers never send to a server. We hold the ciphertext but never the key, so we cannot decrypt it. When someone opens the link, their browser decrypts it locally using the key from the fragment.
              </p>
              <p>
                You can also share a <strong>self-contained link</strong>, a{' '}
                <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">?ws=</code>{' '}
                or{' '}
                <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">?eq=</code>{' '}
                URL that holds the entire workspace in the address itself. It uploads nothing and needs no server, so it also works offline.
              </p>
              <p>
                The difference is only where the data lives: a short link stores encrypted bytes on a server, a self-contained link stores nothing. In neither case can we read your work.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                6. Contact
              </h2>
              <p>
                If you have questions about this policy or our data practices, please contact us via our{' '}
                <a
                  href="https://github.com/trebor/algebranch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={THEME_GLASS.LINK}
                >
                  GitHub repository
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
