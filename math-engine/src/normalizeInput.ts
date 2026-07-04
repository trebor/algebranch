// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Smart-input normalization (#398). Translates the three math dialects people
 * actually copy-paste — LaTeX, Unicode math, and SymPy/Python — into the
 * engine's canonical infix *before* `parseEquation` splits and hands off to
 * mathjs, so equations pasted from a `.tex` file, a chat message, or a Python
 * REPL all "just work".
 *
 * Called at the top of `parseEquation`, so every entry point (the `?eq=` share
 * link, the equation-input modal, the RadialMenu operand input) benefits with no
 * per-call-site wiring.
 *
 * Pipe order matches the RFC (#285 Part 4): LaTeX → Unicode → Python. This is a
 * deliberately *bounded* surface — the transforms below are the whole supported
 * set. Anything outside it falls through unchanged to `parseEquation`'s existing
 * validation error rather than being silently mangled.
 *
 * Guardrail: no global `String.prototype.normalize('NFKC')` runs here. NFKC would
 * collapse the imaginary unit `ⅈ` (U+2148) to ASCII `i` and erase the
 * distinction the engine relies on (see mathjs.ts). Every replacement below is
 * targeted, so `ⅈ` survives verbatim.
 */

import { GREEK_UNICODE } from './serialize';

/**
 * Match a balanced `{...}` group at the start of `str` (leading whitespace
 * skipped). Returns the inner content and the index in `str` just past the
 * closing brace. When `str` doesn't open with a brace, returns a no-op so a
 * malformed macro is left for `parseEquation` to reject.
 */
const matchBrace = (str: string): { inner: string; end: number } => {
  let i = 0;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (str[i] !== '{') return { inner: '', end: 0 };
  let depth = 0;
  const start = i;
  for (; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return { inner: str.slice(start + 1, i), end: i + 1 };
    }
  }
  return { inner: '', end: 0 };
};

/**
 * Resolve `\frac{A}{B}` → `((A)/(B))` and `\sqrt{A}`/`\sqrt[n]{A}` →
 * `sqrt(A)`/`nthRoot(A,n)`, recursing into the arguments so nested fractions and
 * roots survive. Left-to-right, one command at a time.
 */
const resolveFracSqrt = (s: string): string => {
  const fracIdx = s.indexOf('\\frac');
  const sqrtIdx = s.indexOf('\\sqrt');

  // Whichever command appears first, resolve it, then recurse on the tail.
  const first = [fracIdx, sqrtIdx].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  if (first === undefined) return s;

  const prefix = s.slice(0, first);

  if (first === fracIdx) {
    const after = s.slice(first + '\\frac'.length);
    const a = matchBrace(after);
    const b = matchBrace(after.slice(a.end));
    if (a.end === 0 || b.end === 0) return s; // malformed → leave for parser
    const tail = after.slice(a.end + b.end);
    return (
      prefix +
      '((' + resolveFracSqrt(a.inner) + ')/(' + resolveFracSqrt(b.inner) + '))' +
      resolveFracSqrt(tail)
    );
  }

  // \sqrt, optionally with an [n] index.
  let after = s.slice(first + '\\sqrt'.length);
  let index: string | null = null;
  const trimmed = after.replace(/^\s*/, '');
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']');
    if (close > 0) {
      index = trimmed.slice(1, close);
      after = trimmed.slice(close + 1);
    }
  }
  const arg = matchBrace(after);
  if (arg.end === 0) return s; // malformed → leave for parser
  const tail = after.slice(arg.end);
  const radicand = resolveFracSqrt(arg.inner);
  const body =
    index !== null
      ? 'nthRoot(' + radicand + ',' + resolveFracSqrt(index) + ')'
      : 'sqrt(' + radicand + ')';
  return prefix + body + resolveFracSqrt(tail);
};

/** Convert `^{...}` (LaTeX exponent) to `^(...)`, honoring brace nesting. */
const convertCaretBraces = (s: string): string => {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '^' && s[i + 1] === '{') {
      const { inner, end } = matchBrace(s.slice(i + 1));
      if (end > 0) {
        out += '^(' + convertCaretBraces(inner) + ')';
        i += end; // skip past the closing brace
        continue;
      }
    }
    out += s[i];
  }
  return out;
};

const latexPass = (s: string): string => {
  let out = s
    .replace(/\$/g, '') // math-mode delimiters
    .replace(/\\[,;:!]/g, '') // thin/medium spacing macros
    .replace(/\\q?quad/g, ' ')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\geq/g, '>=')
    .replace(/\\leq/g, '<=')
    .replace(/\\ge\b/g, '>=')
    .replace(/\\le\b/g, '<=');
  out = resolveFracSqrt(out);
  out = convertCaretBraces(out);
  // Anything left of the form `\name` — functions (\sin), greek (\theta), etc.
  // — becomes the bare name; unknown macros fall through for the parser to catch.
  out = out.replace(/\\([a-zA-Z]+)/g, '$1');
  return out;
};

const SUPERSCRIPT_TO_NORMAL: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
};

// Greek glyph → spelled-out name (reverse of the engine's GREEK_UNICODE table).
// Built lazily on first use: `serialize` and this module form an import cycle, so
// reading GREEK_UNICODE at module-init time can see it undefined depending on
// entry order. Deferring to call-time sidesteps the ordering hazard.
let greekGlyphToName: Record<string, string> | null = null;
const getGreekGlyphToName = (): Record<string, string> => {
  if (greekGlyphToName === null) {
    greekGlyphToName = Object.fromEntries(
      Object.entries(GREEK_UNICODE).map(([name, glyph]) => [glyph, name]),
    );
  }
  return greekGlyphToName;
};

const unicodePass = (s: string): string => {
  let out = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => {
    const digits = [...run].map((c) => SUPERSCRIPT_TO_NORMAL[c]).join('');
    // Single non-negative digit → bare `^2`; multi-digit or signed → `^(…)`.
    return digits.length === 1 && digits !== '-' ? '^' + digits : '^(' + digits + ')';
  });
  // √( … ) keeps its parens; √<token> gets wrapped.
  out = out.replace(/√\s*\(/g, 'sqrt(');
  out = out.replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)');
  out = out
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/⋅/g, '*')
    .replace(/−/g, '-'); // U+2212 minus sign
  for (const [glyph, name] of Object.entries(getGreekGlyphToName())) {
    out = out.split(glyph).join(name);
  }
  return out;
};

const pythonPass = (s: string): string =>
  s.replace(/\*\*/g, '^').replace(/==/g, '=');

/** Normalize a LaTeX / Unicode / SymPy math string to canonical engine infix. */
export const normalizeMathInput = (raw: string): string =>
  pythonPass(unicodePass(latexPass(raw)));
