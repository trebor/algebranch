// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import { ArrowLeft } from 'lucide-react';
import { THEME_GLASS } from '../../constants/theme';
import { consentAtom } from '../../store/consent';

export default function PrivacyPage() {
  const router = useRouter();
  const setConsent = useSetAtom(consentAtom);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        <Link
          href="/"
          className={`inline-flex items-center gap-2 ${THEME_GLASS.TEXT_ACCENT} text-sm font-semibold w-fit no-underline`}
        >
          <ArrowLeft size={16} />
          Back to Workspace
        </Link>
        <div className={`${THEME_GLASS.PANEL} p-6 sm:p-10 flex flex-col gap-8`}>
          <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING}`}>
              Privacy Policy
            </h1>
            <p className={`text-xs ${THEME_GLASS.TEXT_MUTED} font-mono`}>
              Last updated: June 20, 2026
            </p>
          </div>

          <div className={`flex flex-col gap-6 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                1. Overview
              </h2>
              <p>
                Algebranch is committed to protecting your privacy. This policy outlines how we handle data and explains our use of anonymous analytics.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                2. Analytics & Cookies
              </h2>
              <p>
                We use Google Analytics (GA4) to collect aggregate, anonymous usage data to understand how visitors interact with the app. This helps us optimize performance and prioritize features. Google Analytics uses cookies (e.g., <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-xs text-indigo-300">_ga</code>) to distinguish unique users, but does not identify you personally.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>
                3. What We Collect (and What We Don&apos;t)
              </h2>
              <p>
                <strong>We collect:</strong> Anonymous interaction events such as starting a new workspace, importing preset equations, copying outputs, and undo/redo operations.
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
                We respect your choice. Analytics tracking is disabled by default (using Google Consent Mode v2) until you choose to opt in via our consent banner. You can change your choice at any time by clicking{' '}
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
                5. Contact
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
