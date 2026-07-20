// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRESET_LIST } from '../../../constants/presets';
import { THEME_GLASS } from '../../../constants/theme';
import { SITE_URL } from '../../../constants/site';
import { docArticleJsonLd } from '../../../constants/structuredData';
import { BackToWorkspaceLink } from '../../../components/BackToWorkspaceLink';
import { SolvePageSettingsCheck } from '../../../components/SolvePageSettingsCheck';

export const dynamic = 'force-static';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PRESET_LIST.filter((p) => p.type === 'solvable').map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const preset = PRESET_LIST.find((p) => p.slug === slug);
  if (!preset) return {};

  const title = `Solve ${preset.equation} Step-by-Step — Algebranch`;
  const description = `Learn how to solve the equation ${preset.equation} with interactive, step-by-step algebraic operations. ${preset.description}`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/solve/${preset.slug}` },
    openGraph: {
      title: `How to solve ${preset.equation} | Algebranch`,
      description,
      url: `${SITE_URL}/solve/${preset.slug}`,
      type: 'article',
    },
  };
}

export default async function SolvePage({ params }: PageProps) {
  const { slug } = await params;
  const preset = PRESET_LIST.find((p) => p.slug === slug);
  if (!preset || preset.type !== 'solvable') {
    notFound();
  }

  const jsonLd = docArticleJsonLd({
    title: `Solve ${preset.equation} Step-by-Step`,
    description: `Learn how to solve the equation ${preset.equation} with interactive, step-by-step algebraic operations. ${preset.description}`,
    url: `${SITE_URL}/solve/${preset.slug}`,
  });

  const solveUrl = `/?eq=${encodeURIComponent(preset.equation)}`;

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full flex flex-col gap-6 relative z-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <BackToWorkspaceLink />

        <div className={`${THEME_GLASS.PANEL} p-8 sm:p-12 flex flex-col gap-8`}>
          <div className="flex flex-col gap-3 border-b border-white/10 pb-6">
            <div className="flex items-center gap-2">
              <span className={`text-[0.6875rem] font-sans font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${THEME_GLASS.BADGE_MUTED}`}>
                {preset.category} · {preset.subcategory}
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING} mt-1`}>
              Solve {preset.label}
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
              {preset.description}
            </p>
          </div>

          {/* Featured Equation display */}
          <div className="flex flex-col items-center justify-center p-8 bg-white/2 rounded-xl border border-white/5 shadow-inner">
            <span className={`text-[0.625rem] font-mono tracking-wider uppercase ${THEME_GLASS.TEXT_MUTED} mb-3`}>
              Equation
            </span>
            <div className="text-xl sm:text-2xl font-mono text-indigo-200 select-all font-semibold tracking-wide">
              {preset.equation}
            </div>
          </div>
          
          <SolvePageSettingsCheck preset={preset} />

          <div className="flex flex-col gap-4">
            <Link
              href={solveUrl}
              className="w-full py-4 px-6 text-center text-sm font-semibold rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>Solve it in the Workspace</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 20 20" 
                fill="currentColor" 
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
              >
                <path 
                  fillRule="evenodd" 
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" 
                  clipRule="evenodd" 
                />
              </svg>
            </Link>
            
            <p className={`text-[0.75rem] text-center ${THEME_GLASS.TEXT_MUTED}`}>
              Interactive step-by-step math tool. Click or drag terms to solve.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-white/5 pt-8 mt-2">
            <div className="flex flex-col gap-1.5">
              <h3 className={`text-xs font-bold ${THEME_GLASS.TEXT_HEADING} uppercase tracking-wider`}>
                Interactive steps
              </h3>
              <p className={`text-[0.8rem] ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
                Drag factors, balance operators on both sides, or complete the square.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className={`text-xs font-bold ${THEME_GLASS.TEXT_HEADING} uppercase tracking-wider`}>
                Instant math validation
              </h3>
              <p className={`text-[0.8rem] ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
                Algebranch prevents invalid algebraic moves, teaching you correct methods.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
