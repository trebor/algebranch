// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The equation-input-format reference (#507). "How do I type a square root / cube
// root / absolute value into Algebranch?" — the fundamental, surface-independent
// question that the input dialog, the RadialMenu operand input, and the
// /link-format deep-link page all share. It lives here, once, as an on-domain
// server-rendered page: crawlable (like the #501 crawl surface), linkable from the
// input dialog's help affordance, and shipped whole in the initial HTML with no
// hydration. The operator/function/constant/alias catalog is imported from the
// shared `inputSyntax` module, whose every example is validated against the real
// parser in tests/inputSyntax.test.ts — so this page cannot document syntax the
// engine rejects.
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { THEME_GLASS } from '../../constants/theme';
import { SITE_URL } from '../../constants/site';
import {
  INPUT_OPERATORS,
  INPUT_FUNCTIONS,
  INPUT_CONSTANTS,
  INPUT_ALIASES,
} from '../../constants/inputSyntax';

export const metadata: Metadata = {
  title: 'Equation input format — how to type equations into Algebranch',
  description:
    'The complete equation-input syntax Algebranch accepts: operators, relations, functions (sqrt, nthRoot, abs, log, trig), constants, and the LaTeX / Unicode / Python forms it auto-converts. Written for humans and AI assistants.',
  alternates: { canonical: `${SITE_URL}/input-format` },
  openGraph: {
    title: 'Algebranch equation input format',
    description:
      'Operators, functions, constants, and the LaTeX / Unicode / Python aliases Algebranch accepts when you type an equation.',
    url: `${SITE_URL}/input-format`,
    type: 'article',
  },
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>{children}</h2>
  );
}

export default function InputFormatPage() {
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
            <h1
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${THEME_GLASS.TEXT_HEADING}`}
            >
              Equation input format
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
              The operators, functions, and constants you can use when entering an equation, plus the
              LaTeX, Unicode, and Python forms Algebranch converts on input. This is the complete set;
              anything outside it is reported as an input error.
            </p>
          </div>

          <div className={`flex flex-col gap-8 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            <section className="flex flex-col gap-3">
              <SectionHeading>Operators and relations</SectionHeading>
              <p>
                Write equations with ordinary infix operators. Implicit multiplication like{' '}
                <code className={THEME_GLASS.CODE_CHIP}>2x</code> is understood, and every equation
                needs exactly one relation — <code className={THEME_GLASS.CODE_CHIP}>=</code> for an
                equation, or <code className={THEME_GLASS.CODE_CHIP}>&lt; &gt; &lt;= &gt;=</code> for
                an inequality.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {INPUT_OPERATORS.map(({ sym, name, example }) => (
                      <tr key={sym} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <code className={THEME_GLASS.CODE_CHIP}>{sym}</code>
                        </td>
                        <td className="py-2 pr-4">{name}</td>
                        <td className={`py-2 ${THEME_GLASS.TEXT_MUTED} whitespace-nowrap`}>
                          <code className={THEME_GLASS.CODE_CHIP}>{example}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Functions</SectionHeading>
              <p>
                Function names are case-sensitive. The one to watch is{' '}
                <code className={THEME_GLASS.CODE_CHIP}>nthRoot</code> — it is camelCase and takes the
                radicand <em>before</em> the index, so a cube root of{' '}
                <code className={THEME_GLASS.CODE_CHIP}>x</code> is{' '}
                <code className={THEME_GLASS.CODE_CHIP}>nthRoot(x, 3)</code>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {INPUT_FUNCTIONS.map(({ call, name }) => (
                      <tr key={call} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <code className={THEME_GLASS.CODE_CHIP}>{call}</code>
                        </td>
                        <td className="py-2">{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Constants</SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {INPUT_CONSTANTS.map(({ call, name }) => (
                      <tr key={call} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <code className={THEME_GLASS.CODE_CHIP}>{call}</code>
                        </td>
                        <td className="py-2">{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Pasting from LaTeX, Unicode, or Python</SectionHeading>
              <p>
                An equation copied from a <code className={THEME_GLASS.CODE_CHIP}>.tex</code> file, a
                chat message, or a Python REPL is accepted as-is — Algebranch rewrites the common
                forms into the syntax above. The left column is what you can type; the right is the
                plain form it becomes.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b border-white/10 ${THEME_GLASS.TEXT_MUTED}`}>
                      <th className="py-2 pr-4 font-semibold">You can write</th>
                      <th className="py-2 pr-4 font-semibold">Same as</th>
                      <th className="py-2 font-semibold">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INPUT_ALIASES.map(({ input, canonical, note }) => (
                      <tr key={input} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <code className={THEME_GLASS.CODE_CHIP}>{input}</code>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <code className={THEME_GLASS.CODE_CHIP}>{canonical}</code>
                        </td>
                        <td className={`py-2 ${THEME_GLASS.TEXT_MUTED}`}>{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Related</SectionHeading>
              <p>
                To turn an equation into a shareable link, see the{' '}
                <Link href="/link-format" className={THEME_GLASS.LINK}>
                  deep-link grammar
                </Link>{' '}
                — the same syntax plus the URL-encoding rules for a{' '}
                <code className={THEME_GLASS.CODE_CHIP}>?eq=</code> address. For the full catalog of
                what Algebranch can then <em>do</em> with an equation — every transform, identity, and
                what is out of scope — see the{' '}
                <a
                  href="https://github.com/trebor/algebranch/blob/main/docs/features.md"
                  className={THEME_GLASS.LINK}
                >
                  features reference
                </a>{' '}
                and{' '}
                <a
                  href="https://github.com/trebor/algebranch/blob/main/docs/scope.md"
                  className={THEME_GLASS.LINK}
                >
                  scope
                </a>{' '}
                docs.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
