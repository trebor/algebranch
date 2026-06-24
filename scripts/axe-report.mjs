// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris
/**
 * axe-report.mjs — pure pass/fail + reporting logic for the browser-axe CI run.
 *
 * scripts/axe-ci.mjs drives a real headless Chromium and collects axe-core
 * violations per audited surface; this module turns those raw results into the
 * exit-code decision and the human-readable report. Keeping it free of any
 * Playwright/axe imports makes it unit-testable under vitest (see
 * ui/tests/axe-report.test.ts).
 */

/**
 * @typedef {Object} AxeNode
 * @property {string[]} target        CSS selector path to the failing element.
 * @property {string}   failureSummary Why axe flagged it (e.g. the contrast ratio).
 *
 * @typedef {Object} AxeViolation
 * @property {string}   id       Rule id, e.g. "color-contrast".
 * @property {string}   impact   "minor" | "moderate" | "serious" | "critical".
 * @property {string}   help     Short rule description.
 * @property {string}   helpUrl  Deque docs link.
 * @property {AxeNode[]} nodes   Each failing element on the page.
 *
 * @typedef {Object} Surface
 * @property {string}        name       Label for the audited surface.
 * @property {AxeViolation[]} violations axe violations found on it.
 */

/**
 * Build the CI verdict + report from per-surface axe results.
 *
 * @param {Surface[]} surfaces
 * @returns {{ ok: boolean, totalViolations: number, text: string }}
 */
export const formatAxeReport = (surfaces) => {
  // An empty surface list means the runner never actually audited anything —
  // treat that as a failure so a broken runner can't masquerade as a clean pass.
  if (!surfaces || surfaces.length === 0) {
    return {
      ok: false,
      totalViolations: 0,
      text: 'axe browser audit: no surfaces were audited — the runner produced no results.',
    };
  }

  const lines = ['axe browser audit (color-contrast + structural rules):', ''];
  let totalViolations = 0;

  for (const { name, violations } of surfaces) {
    const count = violations.length;
    totalViolations += count;
    const mark = count === 0 ? '✓' : '✗';
    lines.push(`${mark} ${name} — ${count} violation${count === 1 ? '' : 's'}`);

    for (const v of violations) {
      lines.push(`    [${v.impact}] ${v.id}: ${v.help}`);
      lines.push(`      ${v.helpUrl}`);
      for (const node of v.nodes) {
        lines.push(`      • ${node.target.join(' ')}`);
        if (node.failureSummary) {
          lines.push(`        ${node.failureSummary.replace(/\n/g, ' ')}`);
        }
      }
    }
  }

  lines.push('');
  lines.push(
    totalViolations === 0
      ? 'Result: 0 violations across all surfaces.'
      : `Result: ${totalViolations} violation${totalViolations === 1 ? '' : 's'} — failing.`,
  );

  return { ok: totalViolations === 0, totalViolations, text: lines.join('\n') };
};
