import { describe, it, expect } from 'vitest';
// The browser-axe CI runner (scripts/axe-ci.mjs) is glue around Playwright and
// can't lead with a unit test, but its pass/fail decision and human-readable
// report are pure — so that logic lives in scripts/axe-report.mjs and is driven
// from here.
import { formatAxeReport } from '../../scripts/axe-report.mjs';

const contrastViolation = {
  id: 'color-contrast',
  impact: 'serious',
  help: 'Elements must meet minimum color contrast ratio thresholds',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  nodes: [
    { target: ['.glass-pill'], failureSummary: 'Fix any of the following: contrast 3.1:1' },
    { target: ['.muted-label'], failureSummary: 'Fix any of the following: contrast 2.4:1' },
  ],
};

describe('formatAxeReport', () => {
  it('reports ok with a clean summary when every surface has zero violations', () => {
    const { ok, totalViolations, text } = formatAxeReport([
      { name: 'workspace', violations: [] },
      { name: 'settings modal', violations: [] },
    ]);
    expect(ok).toBe(true);
    expect(totalViolations).toBe(0);
    expect(text).toContain('workspace');
    expect(text).toContain('settings modal');
    expect(text).toMatch(/0 violations/i);
  });

  it('flags failure and counts violations across surfaces', () => {
    const { ok, totalViolations, text } = formatAxeReport([
      { name: 'workspace', violations: [contrastViolation] },
      { name: 'settings modal', violations: [] },
    ]);
    expect(ok).toBe(false);
    expect(totalViolations).toBe(1);
    expect(text).toContain('color-contrast');
  });

  it('surfaces each failing node target so a regression is actionable', () => {
    const { text } = formatAxeReport([{ name: 'workspace', violations: [contrastViolation] }]);
    expect(text).toContain('.glass-pill');
    expect(text).toContain('.muted-label');
    expect(text).toContain('serious');
  });

  it('treats an empty surface list as a failure rather than a vacuous pass', () => {
    const { ok, text } = formatAxeReport([]);
    expect(ok).toBe(false);
    expect(text).toMatch(/no surfaces/i);
  });
});
