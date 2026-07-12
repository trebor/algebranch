// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { THEME_GLASS } from '../constants/theme';

// The "Back to Workspace" affordance shared by every standalone doc/reference
// route (#514). It was copied byte-for-byte across five pages; consolidating it
// here means the one change that mattered — Escape returns to the workspace —
// lands on all of them and can't drift. Escape mirrors the visible link exactly
// (navigate to `/`), so the key behaves the same whether the reader arrived at
// the page cold or opened the doc as an in-app modal. A tiny client island on
// otherwise-static, crawlable pages.
export function BackToWorkspaceLink() {
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        router.push('/');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 ${THEME_GLASS.TEXT_ACCENT} text-sm font-semibold w-fit no-underline`}
    >
      <ArrowLeft size={16} />
      Back to Workspace
    </Link>
  );
}
