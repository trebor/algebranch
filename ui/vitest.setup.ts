// Extends `expect` with jest-dom matchers (toBeInTheDocument, toHaveAccessibleName, …)
// and registers automatic DOM cleanup between tests.
import '@testing-library/jest-dom/vitest';

// Registers the jest-axe `toHaveNoViolations` matcher for the a11y audit tests (#145).
// NOTE: axe's color-contrast rule is a no-op under jsdom (no layout/computed colors),
// so these tests guard structural a11y (accessible names, roles); contrast is verified
// in a real browser via Playwright.
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';
expect.extend(toHaveNoViolations);
