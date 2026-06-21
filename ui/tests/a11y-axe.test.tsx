import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { CopyFormatMenu } from '@/components/CopyFormatMenu';

/**
 * Automated structural a11y audit for the icon-button label sweep (#145).
 *
 * Scope/limits: axe runs in-process under jsdom, so it guards *structural*
 * accessibility — every interactive control resolves an accessible name, roles
 * are valid, etc. The `color-contrast` rule needs a real browser (computed
 * colors + layout) and is inert here, so the THEME_GLASS contrast bumps are
 * verified separately via Playwright, not this suite.
 */
describe('a11y: axe structural audit', () => {
  it('guardrail — axe flags an icon-only button with no accessible name', async () => {
    // Proves the audit is actually evaluating: an unlabeled icon button (the
    // exact failure mode the #145 sweep fixes) must register a violation, so a
    // future regression that drops an aria-label cannot pass silently.
    const { container } = render(
      <button type="button">
        <svg aria-hidden="true" width="16" height="16" />
      </button>,
    );
    const results = await axe(container);
    expect(results.violations.map((v) => v.id)).toContain('button-name');
  });

  it('CopyFormatMenu trigger has no structural a11y violations', async () => {
    const { container, getByRole } = render(
      <CopyFormatMenu
        getText={() => 'x = 1'}
        triggerClassName="p-2"
        trackAction="copy_test"
        trackCategory="test"
        trackLabel="test"
      />,
    );
    // The icon-only trigger carries a real accessible name (the sweep's payload).
    expect(getByRole('button')).toHaveAccessibleName('Copy options');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
