// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The deep-link grammar spec (#501). Algebranch's unique agent affordance: any
// assistant can hand-mint a working link to a student's exact problem mid-answer
// — "practice the steps yourself here" with a live URL. This page documents the
// `?eq=` grammar and encoding for the crawlers and agents that will read it, as
// much as for humans. It is a server component so the whole spec ships in the
// initial HTML with no hydration, and its worked examples are generated from the
// same `buildEqUrl` encoder the rest of the app uses, so the table can never
// drift from a link that actually works.
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { THEME_GLASS } from '../../constants/theme';
import { SITE_URL } from '../../constants/site';
import { buildEqUrl } from '../../utils/linkFormat';

export const metadata: Metadata = {
  title: 'Deep-link grammar — build a ?eq= URL for any equation',
  description:
    'How to construct an Algebranch deep link: the ?eq= equation grammar, URL-encoding rules, worked examples, and how ?ws= workspace links and short links work. Written for AI assistants and humans.',
  alternates: { canonical: `${SITE_URL}/link-format` },
  openGraph: {
    title: 'Algebranch deep-link grammar',
    description:
      'Construct a working ?eq= link to any algebra problem — syntax, URL-encoding, and worked examples.',
    url: `${SITE_URL}/link-format`,
    type: 'article',
  },
};

// Worked examples, rendered straight from the shared encoder so the shown URL is
// always one that round-trips. Plain-text equation on the left, live link right.
const EXAMPLES: { eq: string; note: string }[] = [
  { eq: 'x^2-9=0', note: 'Quadratic — note ^ and = are encoded' },
  { eq: 'sqrt(4*9)+x=12', note: 'Radical, product, and sum — sqrt(), *, +' },
  { eq: '(x+1)*(x-1)=0', note: 'Parentheses and * are encoded so the link stays clickable' },
  { eq: '3/4+1/2=x', note: 'Fractions — / is encoded' },
  { eq: '2*x+3>7', note: 'Inequalities work too' },
];

// The encoding rule, one row per character that must be percent-encoded. Matches
// the AGENTS.md table: encodeURIComponent covers = / + , ; ( ) * are added because
// encodeURIComponent leaves them raw yet they break the round-trip or the link.
const ENCODING: { char: string; code: string; why: string }[] = [
  { char: '=', code: '%3D', why: 'Separates the query key from the value' },
  { char: '+', code: '%2B', why: 'A raw + form-decodes to a space, corrupting sums' },
  { char: '/', code: '%2F', why: 'Reserved as a path separator' },
  { char: ',', code: '%2C', why: 'Reserved; used between arguments' },
  { char: '(', code: '%28', why: 'Kept raw by encodeURIComponent' },
  { char: ')', code: '%29', why: 'Kept raw; a trailing ) is often dropped from a clickable link' },
  { char: '*', code: '%2A', why: 'Kept raw by encodeURIComponent' },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={`text-base font-bold ${THEME_GLASS.TEXT_HEADING} tracking-wider`}>{children}</h2>
  );
}

export default function LinkFormatPage() {
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
              Deep-link grammar
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED} leading-relaxed`}>
              Every Algebranch workspace can be reached by a link that carries the equation in the
              address. Construct one for any algebra problem and the recipient lands in an
              interactive workspace pre-loaded with it — ideal for pointing a student at their exact
              problem to work through by hand.
            </p>
          </div>

          <div className={`flex flex-col gap-8 text-sm ${THEME_GLASS.TEXT_BODY} leading-relaxed`}>
            <section className="flex flex-col gap-3">
              <SectionHeading>The ?eq= parameter</SectionHeading>
              <p>
                Append <code className={THEME_GLASS.CODE_CHIP}>?eq=&lt;equation&gt;</code> to the site
                root. The value is an ordinary algebra equation written with{' '}
                <code className={THEME_GLASS.CODE_CHIP}>+ - * / ^</code> for the operators,{' '}
                <code className={THEME_GLASS.CODE_CHIP}>=</code> joining the two sides,{' '}
                <code className={THEME_GLASS.CODE_CHIP}>&lt; &gt; &lt;= &gt;=</code> for an
                inequality, and function calls such as{' '}
                <code className={THEME_GLASS.CODE_CHIP}>sqrt(...)</code> and{' '}
                <code className={THEME_GLASS.CODE_CHIP}>abs(...)</code>. Implicit multiplication like{' '}
                <code className={THEME_GLASS.CODE_CHIP}>2x</code> is understood. The equation must be
                URL-encoded before it goes in the address.
              </p>
              <p>
                The complete operator, function, and constant catalog — including the LaTeX and
                Unicode forms Algebranch auto-converts — is on the{' '}
                <Link href="/input-format" className={THEME_GLASS.LINK}>
                  equation input format
                </Link>{' '}
                page. This page covers only how to carry that equation in a URL.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>URL-encoding rules</SectionHeading>
              <p>
                Standard <code className={THEME_GLASS.CODE_CHIP}>encodeURIComponent</code> handles
                most of it. It leaves <code className={THEME_GLASS.CODE_CHIP}>(</code>,{' '}
                <code className={THEME_GLASS.CODE_CHIP}>)</code>, and{' '}
                <code className={THEME_GLASS.CODE_CHIP}>*</code> raw, so encode those by hand as well:
                the parentheses because a trailing one is often dropped from a clickable link, and
                the asterisk for consistency. The full set:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b border-white/10 ${THEME_GLASS.TEXT_MUTED}`}>
                      <th className="py-2 pr-4 font-semibold">Character</th>
                      <th className="py-2 pr-4 font-semibold">Encoded</th>
                      <th className="py-2 font-semibold">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENCODING.map(({ char, code, why }) => (
                      <tr key={char} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-4">
                          <code className={THEME_GLASS.CODE_CHIP}>{char}</code>
                        </td>
                        <td className="py-2 pr-4">
                          <code className={THEME_GLASS.CODE_CHIP}>{code}</code>
                        </td>
                        <td className={`py-2 ${THEME_GLASS.TEXT_MUTED}`}>{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Worked examples</SectionHeading>
              <ul className="flex flex-col gap-4 list-none p-0 m-0">
                {EXAMPLES.map(({ eq, note }) => (
                  <li key={eq} className="flex flex-col gap-1">
                    <code className={THEME_GLASS.CODE_CHIP}>{eq}</code>
                    <a
                      href={buildEqUrl(eq)}
                      className={`${THEME_GLASS.LINK} font-mono text-xs break-all`}
                    >
                      {buildEqUrl(eq)}
                    </a>
                    <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>{note}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>Workspace links and short links</SectionHeading>
              <p>
                A <code className={THEME_GLASS.CODE_CHIP}>?eq=</code> link carries a single equation.
                To share an entire session — multiple workspace tabs and their full derivation
                history — Algebranch uses a <code className={THEME_GLASS.CODE_CHIP}>?ws=</code> link,
                which packs the whole workspace into the address as a compressed token. It uploads
                nothing and works offline.
              </p>
              <p>
                Because a full workspace can make a long URL, sharing from inside the app defaults to
                a <strong>short link</strong> such as{' '}
                <code className={THEME_GLASS.CODE_CHIP}>algebranch.org/s#…</code>. The workspace is
                encrypted in the browser before upload; the decryption key rides in the link fragment
                after the <code className={THEME_GLASS.CODE_CHIP}>#</code>, which browsers never send
                to a server, so the server stores only bytes it cannot read. For minting a link to a
                single problem, prefer the readable{' '}
                <code className={THEME_GLASS.CODE_CHIP}>?eq=</code> form documented above.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeading>What Algebranch does</SectionHeading>
              <p>
                Algebranch is a tool for solving equations by hand. The person moves terms and
                applies algebraic identities themselves; the engine only permits valid moves, so the
                math stays correct at every step. It deliberately does <strong>not</strong> hand back
                a final answer — it is a practice environment, not a solver. See the{' '}
                <a href={`${SITE_URL}/privacy`} className={THEME_GLASS.LINK}>
                  privacy policy
                </a>{' '}
                for how shared links handle data.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
